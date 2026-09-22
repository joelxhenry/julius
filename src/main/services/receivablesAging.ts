import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, or, eq, inArray, notInArray } from 'drizzle-orm';
import * as schema from '../database/schema';

/**
 * Receivables aging
 * =================
 *
 * Shared computation behind both the Receivables Summary report and the
 * auto-maintained client credit-standing flag (`clients.is_in_arrears`).
 *
 * The aging axis is "days past the client's allowed terms", NOT raw invoice age:
 *   dueDate      = invoice date + credit terms (in days)
 *   daysOverdue  = today - dueDate
 * An invoice contributes to a bucket only once daysOverdue >= 0 (i.e. it is past
 * due). Amounts still within terms are "current" and excluded from the buckets.
 *
 * Terms resolution mirrors CreditCheckService: the invoice's own credit_terms
 * wins, then the client's, then a 30-day default. Both fields are legacy free
 * text, so `parseInt` extracts the leading day count ("30 DAYS" -> 30) and any
 * non-numeric value falls back to the default.
 */

const DEFAULT_CREDIT_TERMS_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Aging buckets, in days past the client's terms. Order matters (rendered L→R). */
export const AGING_BUCKETS = [
  { key: 'd0_14', label: '0-14 DAYS', min: 0, max: 14 },
  { key: 'd15_29', label: '15-29 DAYS', min: 15, max: 29 },
  { key: 'd30_59', label: '30-59 DAYS', min: 30, max: 59 },
  { key: 'd60_89', label: '60-89 DAYS', min: 60, max: 89 },
  { key: 'd90_plus', label: '+90 DAYS', min: 90, max: Infinity },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]['key'];

export type BucketAmounts = Record<AgingBucketKey, number>;

export interface ReceivablesAgingRow {
  clientId: number;
  clientName: string;
  clNumber: string | null;
  buckets: BucketAmounts;
  /** Sum of all overdue buckets (does not include amounts still within terms). */
  totalOverdue: number;
  /** Whether the admin has manually flagged this client as bad credit. */
  isBadCredit: boolean;
}

export interface ReceivablesSummaryResult {
  /** ISO date the aging was computed against (local midnight of "today"). */
  asOf: string;
  rows: ReceivablesAgingRow[];
  totals: BucketAmounts & { totalOverdue: number };
}

function emptyBuckets(): BucketAmounts {
  return { d0_14: 0, d15_29: 0, d30_59: 0, d60_89: 0, d90_plus: 0 };
}

function resolveTermsDays(invoiceTerms: string | null, clientTerms: string | null): number {
  const parsed = parseInt(invoiceTerms || clientTerms || '', 10);
  return Number.isNaN(parsed) ? DEFAULT_CREDIT_TERMS_DAYS : parsed;
}

function bucketFor(daysOverdue: number): AgingBucketKey | null {
  if (daysOverdue < 0) return null; // still within terms
  for (const b of AGING_BUCKETS) {
    if (daysOverdue >= b.min && daysOverdue <= b.max) return b.key;
  }
  return null;
}

/**
 * Compute the receivables aging for every client that has outstanding amounts
 * past their terms. Clients with no overdue balance are omitted from `rows`
 * (they belong to the "current" side and would only add empty lines), matching
 * the legacy Receivables Summary report.
 */
export async function computeReceivablesAging(
  db: NodePgDatabase<typeof schema>,
  asOf: Date = new Date(),
): Promise<ReceivablesSummaryResult> {
  // Normalize "today" to local midnight so day-count math is stable within a day.
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());

  // Client lookup (name, cl number, terms fallback, manual bad-credit flag).
  const clients = await db
    .select({
      id: schema.clients.id,
      clientName: schema.clients.clientName,
      clNumber: schema.clients.clNumber,
      creditTerms: schema.clients.creditTerms,
      isBadCredit: schema.clients.isBadCredit,
    })
    .from(schema.clients);

  const clientById = new Map(clients.map((c) => [c.id, c]));

  // Only invoices that can still owe money: active or partially paid, not archived.
  const openInvoices = await db
    .select({
      clientId: schema.invoices.clientId,
      invDate: schema.invoices.invDate,
      creditTerms: schema.invoices.creditTerms,
      total: schema.invoices.total,
      totalPaid: schema.invoices.totalPaid,
    })
    .from(schema.invoices)
    .where(
      and(
        or(eq(schema.invoices.status, 'active'), eq(schema.invoices.status, 'partially_paid')),
        eq(schema.invoices.isArchived, false),
      ),
    );

  const rowByClient = new Map<number, ReceivablesAgingRow>();

  for (const inv of openInvoices) {
    if (inv.clientId == null) continue; // walk-in / no client -> no credit standing
    const client = clientById.get(inv.clientId);
    if (!client) continue;

    const outstanding = parseFloat(inv.total || '0') - parseFloat(inv.totalPaid || '0');
    if (outstanding <= 0) continue;

    const termsDays = resolveTermsDays(inv.creditTerms, client.creditTerms);
    const dueDate = new Date(inv.invDate);
    dueDate.setDate(dueDate.getDate() + termsDays);
    const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    const daysOverdue = Math.floor((today.getTime() - dueMidnight.getTime()) / MS_PER_DAY);
    const bucket = bucketFor(daysOverdue);
    if (!bucket) continue; // within terms -> not part of the aging report

    let row = rowByClient.get(inv.clientId);
    if (!row) {
      row = {
        clientId: client.id,
        clientName: client.clientName,
        clNumber: client.clNumber,
        buckets: emptyBuckets(),
        totalOverdue: 0,
        isBadCredit: client.isBadCredit,
      };
      rowByClient.set(inv.clientId, row);
    }
    row.buckets[bucket] += outstanding;
    row.totalOverdue += outstanding;
  }

  const rows = [...rowByClient.values()].sort((a, b) =>
    a.clientName.localeCompare(b.clientName),
  );

  const totals = { ...emptyBuckets(), totalOverdue: 0 };
  for (const row of rows) {
    for (const b of AGING_BUCKETS) totals[b.key] += row.buckets[b.key];
    totals.totalOverdue += row.totalOverdue;
  }

  const asOfIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;

  return { asOf: asOfIso, rows, totals };
}

/**
 * Persist the credit-standing flag derived from an aging result: every client in
 * `rows` has an overdue balance (is in arrears); every other client is not.
 * Only rows whose stored flag differs are written. Returns how many clients were
 * updated and how many are currently in arrears.
 */
export async function applyCreditStanding(
  db: NodePgDatabase<typeof schema>,
  summary: ReceivablesSummaryResult,
): Promise<{ inArrears: number; updated: number }> {
  const inArrearsIds = summary.rows.map((r) => r.clientId);

  // Set flag TRUE for in-arrears clients that are not already flagged.
  let flaggedOn = 0;
  if (inArrearsIds.length > 0) {
    const res = await db
      .update(schema.clients)
      .set({ isInArrears: true, updatedAt: new Date() })
      .where(and(inArray(schema.clients.id, inArrearsIds), eq(schema.clients.isInArrears, false)));
    flaggedOn = res.rowCount ?? 0;
  }

  // Clear flag for everyone else currently flagged (they've paid down / no longer overdue).
  const clearWhere =
    inArrearsIds.length > 0
      ? and(eq(schema.clients.isInArrears, true), notInArray(schema.clients.id, inArrearsIds))
      : eq(schema.clients.isInArrears, true);
  const clearRes = await db
    .update(schema.clients)
    .set({ isInArrears: false, updatedAt: new Date() })
    .where(clearWhere);
  const flaggedOff = clearRes.rowCount ?? 0;

  return { inArrears: inArrearsIds.length, updated: flaggedOn + flaggedOff };
}
