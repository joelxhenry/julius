import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, or, gte, lte, eq, count, sql, desc, isNull } from 'drizzle-orm';
import * as schema from '../database/schema';
import { canonicalizePaymentType, CANONICAL_PAYMENT_TYPES } from '../../shared/constants/payments';

/**
 * Sales-listing group label for store credit issued by credit-note returns.
 * Deliberately distinct from the canonical "Store Credit" tender type so issued
 * credit (a non-cash refund) never merges with store credit spent as payment.
 */
const STORE_CREDIT_ISSUED_TYPE = 'Store Credit Issued';

// ── Param / Result types ────────────────────────────────────────────

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface SalesReportPaymentType {
  method: string;
  count: number;
  total: number;
}

export interface SalesReportDetailItem {
  invoiceNumber: string | null;
  paymentType: string;
  clientName: string | null;
  date: string | null;
  amount: number;
  /** Transaction reference (the "Reference #" captured on the payment). */
  reference: string | null;
  /** Free-text notes captured on the payment, if any. */
  notes: string | null;
}

export interface SalesSummaryResult {
  startDate: string | null;
  endDate: string | null;
  // Summary block
  netSales: number; // pre-tax (invoice sub_total)
  taxCollected: number;
  grossSales: number; // net + tax (invoice total)
  // Customer stats
  numCustomers: number; // distinct clients that bought in the period
  averageSale: number; // netSales / numCustomers
  // Payment stats
  numPayments: number;
  valuePayments: number;
  // Cash refunds: money actually paid back out (cash/bank/card invoice refunds
  // AND credit-note cash-outs). Reconciles against the drawer.
  numRefunds: number;
  valueRefunds: number;
  // Store credit issued via credit-note returns. Non-cash (no money leaves), so
  // it is reported separately from valueRefunds to avoid double-counting a
  // return that is later cashed out.
  numStoreCreditIssued: number;
  valueStoreCreditIssued: number;
  numDiscounts: number;
  valueDiscounts: number;
  // Payment breakdown + per-payment detail listing
  paymentTypes: SalesReportPaymentType[];
  detail: SalesReportDetailItem[];
}

export interface SalespersonRow {
  employeeId: number;
  name: string;
  invoiceCount: number;
  invoiceTotal: number;
  quoteCount: number;
  quoteTotal: number;
  creditNoteCount: number;
  creditNoteTotal: number;
  netSales: number;
}

export interface SalespersonPerformanceResult {
  rows: SalespersonRow[];
  totals: Omit<SalespersonRow, 'employeeId' | 'name'>;
}

export interface PaymentCollectionItem {
  paymentId: number;
  paymentDate: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  paymentMethod: string | null;
  amount: number;
  processedBy: string | null;
}

export interface PaymentMethodSummary {
  method: string;
  total: number;
  count: number;
}

export interface PaymentCollectionResult {
  payments: PaymentCollectionItem[];
  totalCollected: number;
  byMethod: PaymentMethodSummary[];
}

export interface PurchaseReportParams {
  year: number;
}

export interface PurchaseReportMonthRow {
  month: number; // 1-12
  total: number; // bill total (gross)
  paidOut: number; // total_paid
  payable: number; // total - paidOut
}

export interface PurchaseReportTotals {
  total: number;
  paidOut: number;
  payable: number;
}

export interface PurchaseSummaryResult {
  year: number;
  months: PurchaseReportMonthRow[]; // always 12 rows, January..December
  totals: PurchaseReportTotals;
}

// ── Service ─────────────────────────────────────────────────────────

export class ReportService {
  private db: NodePgDatabase<typeof schema>;

  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }

  // ── 1. Sales Summary ───────────────────────────────────────────

  async getSalesSummary(params: DateRangeParams): Promise<SalesSummaryResult> {
    const { startDate, endDate } = params;

    // ── Invoice aggregates (Net / Tax / Gross + distinct customers) ──
    const invConditions = [];
    if (startDate) invConditions.push(gte(schema.invoices.invDate, startDate));
    if (endDate) invConditions.push(lte(schema.invoices.invDate, endDate));

    const invResult = await this.db
      .select({
        netSales: sql<string>`COALESCE(SUM(CAST(${schema.invoices.subTotal} AS numeric)), 0)`,
        taxCollected: sql<string>`COALESCE(SUM(CAST(${schema.invoices.tax} AS numeric)), 0)`,
        grossSales: sql<string>`COALESCE(SUM(CAST(${schema.invoices.total} AS numeric)), 0)`,
        // Distinct customers: dedupe by client, falling back to the invoice's
        // own number for anonymous / walk-in sales so each still counts once.
        numCustomers: sql<string>`COUNT(DISTINCT COALESCE(CAST(${schema.invoices.clientId} AS text), ${schema.invoices.clientName}, ${schema.invoices.invNumber}))`,
      })
      .from(schema.invoices)
      .where(invConditions.length ? and(...invConditions) : undefined);

    // ── Line-item discounts on invoices in range ─────────────────────
    const discConditions = [
      eq(schema.documentLineItems.documentType, 'INVOICE'),
      sql`CAST(${schema.documentLineItems.discount} AS numeric) > 0`,
    ];
    if (startDate) discConditions.push(gte(schema.invoices.invDate, startDate));
    if (endDate) discConditions.push(lte(schema.invoices.invDate, endDate));

    const discResult = await this.db
      .select({
        count: count(),
        total: sql<string>`COALESCE(SUM(CAST(${schema.documentLineItems.discount} AS numeric)), 0)`,
      })
      .from(schema.documentLineItems)
      .innerJoin(schema.invoices, eq(schema.documentLineItems.documentNumber, schema.invoices.invNumber))
      .where(and(...discConditions));

    // ── Money movements in range, with client + method resolution ──
    // Two document types feed the report:
    //  • INVOICE payments — receipts (positive) and refunds (negative).
    //  • CREDIT cash-outs — a credit note's balance paid back out as real money.
    //    These have no invoice link (invoiceNumber IS NULL), which distinguishes
    //    them from credit-note applications (store credit spent on an invoice),
    //    which are intentionally excluded.
    const payDateConditions = [];
    if (startDate) payDateConditions.push(gte(schema.payments.paymentDate, startDate));
    if (endDate) payDateConditions.push(lte(schema.payments.paymentDate, endDate));

    const [payRows, methods] = await Promise.all([
      this.db
        .select({ payment: schema.payments, clientName: schema.invoices.clientName })
        .from(schema.payments)
        .leftJoin(schema.invoices, eq(schema.payments.invoiceNumber, schema.invoices.invNumber))
        .where(
          and(
            or(
              eq(schema.payments.documentType, 'INVOICE'),
              and(
                eq(schema.payments.documentType, 'CREDIT'),
                isNull(schema.payments.invoiceNumber),
              ),
            ),
            ...payDateConditions,
          ),
        )
        .orderBy(schema.payments.invoiceNumber),
      this.db.select().from(schema.paymentMethods),
    ]);

    // Method code lives in paymentDesc or paymentDesc2; resolve to a name, then
    // fold it into one of the fixed canonical report payment types so the report
    // only ever shows Cash / Bank Transfer / Cheque / Credit-Debit Card / Store
    // Credit regardless of the varied labels stored on individual payments.
    const methodMap = new Map<string, string>();
    methods.forEach((m) => methodMap.set(m.code, m.name));
    const resolveMethod = (p: schema.Payment): string => {
      const codeMatch = [p.paymentDesc, p.paymentDesc2].find((v) => v && methodMap.has(v)) || null;
      const name = codeMatch ? (methodMap.get(codeMatch) ?? '') : '';
      return canonicalizePaymentType(name || p.paymentDesc || p.paymentDesc2);
    };

    // Free-text notes: the desc fields that aren't the method code. paymentDesc
    // carries the user's notes (or a VOID/REFUND/credit-note label) while
    // paymentDesc2 usually carries the method code; legacy rows may reverse them,
    // so anything that isn't a known code is treated as a note.
    const resolveNotes = (p: schema.Payment): string | null => {
      const parts: string[] = [];
      for (const v of [p.paymentDesc, p.paymentDesc2]) {
        if (v && !methodMap.has(v) && !parts.includes(v)) parts.push(v);
      }
      return parts.length ? parts.join(' • ') : null;
    };

    let numPayments = 0;
    let valuePayments = 0;
    let numRefunds = 0;
    let valueRefunds = 0;
    const typeMap = new Map<string, SalesReportPaymentType>();
    const detail: SalesReportDetailItem[] = [];

    for (const row of payRows) {
      const p = row.payment;
      const amount = Number(p.amount ?? 0);
      const method = resolveMethod(p);

      if (p.documentType === 'CREDIT') {
        // Credit-note cash-out: store credit converted to money paid back out via
        // `method` (recorded as a positive amount). Counts as a cash refund and
        // shows as a negative line under its payout method. A rare void reversal
        // (negative amount) nets back against the total.
        if (amount >= 0) numRefunds += 1;
        valueRefunds += amount;
        detail.push({
          invoiceNumber: p.creditNoteNumber ?? null,
          paymentType: method,
          clientName: row.clientName ?? p.payerName ?? null,
          date: p.paymentDate,
          amount: -amount,
          reference: p.transactionReference ?? null,
          notes: resolveNotes(p),
        });
        continue;
      }

      if (amount < 0) {
        numRefunds += 1;
        valueRefunds += Math.abs(amount);
      } else {
        numPayments += 1;
        valuePayments += amount;
        // Payment Report breakdown groups positive receipts by type.
        const existing = typeMap.get(method);
        if (existing) {
          existing.count += 1;
          existing.total += amount;
        } else {
          typeMap.set(method, { method, count: 1, total: amount });
        }
      }

      detail.push({
        invoiceNumber: p.invoiceNumber,
        paymentType: method,
        clientName: row.clientName ?? null,
        date: p.paymentDate,
        amount,
        reference: p.transactionReference ?? null,
        notes: resolveNotes(p),
      });
    }

    // ── Store credit issued via credit-note returns ──────────────────
    // A credit-note return already reduces the invoice (so Net/Gross Sales drop),
    // but no money leaves the drawer. Report it as its own non-cash refund line -
    // visible in the listing under a distinct "Store Credit Issued" type and in
    // its own summary stat - kept apart from valueRefunds so a return that is
    // later cashed out is not counted twice.
    const cnConditions = [eq(schema.creditNotes.isArchived, false)];
    if (startDate) cnConditions.push(gte(schema.creditNotes.crDate, startDate));
    if (endDate) cnConditions.push(lte(schema.creditNotes.crDate, endDate));

    const cnRows = await this.db
      .select()
      .from(schema.creditNotes)
      .where(and(...cnConditions))
      .orderBy(schema.creditNotes.crNumber);

    let numStoreCreditIssued = 0;
    let valueStoreCreditIssued = 0;
    for (const cn of cnRows) {
      const total = Number(cn.total ?? 0);
      if (total <= 0) continue;
      numStoreCreditIssued += 1;
      valueStoreCreditIssued += total;
      detail.push({
        invoiceNumber: cn.invNumber ?? cn.crNumber,
        paymentType: STORE_CREDIT_ISSUED_TYPE,
        clientName: cn.clientName ?? null,
        date: cn.crDate,
        amount: -total,
        reference: cn.reference ?? null,
        notes: `Credit note ${cn.crNumber}`,
      });
    }

    const netSales = Number(invResult[0]?.netSales ?? 0);
    const numCustomers = Number(invResult[0]?.numCustomers ?? 0);

    return {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      netSales,
      taxCollected: Number(invResult[0]?.taxCollected ?? 0),
      grossSales: Number(invResult[0]?.grossSales ?? 0),
      numCustomers,
      averageSale: numCustomers > 0 ? netSales / numCustomers : 0,
      numPayments,
      valuePayments,
      numRefunds,
      valueRefunds,
      numStoreCreditIssued,
      valueStoreCreditIssued,
      numDiscounts: Number(discResult[0]?.count ?? 0),
      valueDiscounts: Number(discResult[0]?.total ?? 0),
      paymentTypes: Array.from(typeMap.values()).sort(
        (a, b) =>
          CANONICAL_PAYMENT_TYPES.indexOf(a.method as (typeof CANONICAL_PAYMENT_TYPES)[number]) -
          CANONICAL_PAYMENT_TYPES.indexOf(b.method as (typeof CANONICAL_PAYMENT_TYPES)[number]),
      ),
      detail,
    };
  }

  // ── 2. Payment Collection ──────────────────────────────────────

  async getPaymentCollection(params: DateRangeParams): Promise<PaymentCollectionResult> {
    const { startDate, endDate } = params;

    const conditions = [eq(schema.payments.documentType, 'INVOICE')];
    if (startDate) conditions.push(gte(schema.payments.paymentDate, startDate));
    if (endDate) conditions.push(lte(schema.payments.paymentDate, endDate));

    // Get payments with joined invoice (for client name) and employee (for processor name)
    const results = await this.db
      .select({
        payment: schema.payments,
        clientName: schema.invoices.clientName,
        processorFirstName: schema.employees.firstName,
        processorLastName: schema.employees.lastName,
        processorCode: schema.employees.code,
      })
      .from(schema.payments)
      .leftJoin(schema.invoices, eq(schema.payments.invoiceNumber, schema.invoices.invNumber))
      .leftJoin(schema.employees, eq(schema.payments.processedById, schema.employees.id))
      .where(and(...conditions))
      .orderBy(desc(schema.payments.paymentDate));

    const payments: PaymentCollectionItem[] = results.map((r) => ({
      paymentId: r.payment.id,
      paymentDate: r.payment.paymentDate,
      invoiceNumber: r.payment.invoiceNumber,
      clientName: r.clientName ?? null,
      paymentMethod: r.payment.paymentDesc,
      amount: Number(r.payment.amount ?? 0),
      processedBy: r.processorFirstName
        ? [r.processorFirstName, r.processorLastName].filter(Boolean).join(' ')
        : r.processorCode ?? null,
    }));

    const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

    // Group by method
    const methodMap = new Map<string, PaymentMethodSummary>();
    for (const p of payments) {
      const key = p.paymentMethod || 'Unknown';
      const existing = methodMap.get(key);
      if (existing) {
        existing.total += p.amount;
        existing.count += 1;
      } else {
        methodMap.set(key, { method: key, total: p.amount, count: 1 });
      }
    }

    return {
      payments,
      totalCollected,
      byMethod: Array.from(methodMap.values()),
    };
  }

  // ── 3. Purchase Report (year, month-by-month) ──────────────────

  /**
   * Month-by-month purchases breakdown for a single year, sourced from active
   * supplier bills. Mirrors the legacy purchases screen: for each month it
   * reports Total (gross bill amount), Paid Out (total_paid) and the outstanding
   * Payable (total − paid). Bills only store a gross total in this system — the
   * pre-tax sub_total and tax columns are never populated — so those are
   * deliberately omitted. Voided/inactive bills (status ≠ 'A') are excluded so
   * the figures match the accounts-payable ledger.
   */
  async getPurchaseSummary(params: PurchaseReportParams): Promise<PurchaseSummaryResult> {
    const { year } = params;

    const rows = await this.db
      .select({
        month: sql<string>`EXTRACT(MONTH FROM ${schema.bills.billDate})`,
        total: sql<string>`COALESCE(SUM(CAST(${schema.bills.total} AS numeric)), 0)`,
        paidOut: sql<string>`COALESCE(SUM(CAST(${schema.bills.totalPaid} AS numeric)), 0)`,
      })
      .from(schema.bills)
      .where(
        and(
          eq(schema.bills.status, 'A'),
          sql`${schema.bills.billDate} IS NOT NULL`,
          sql`EXTRACT(YEAR FROM ${schema.bills.billDate}) = ${year}`,
        ),
      )
      .groupBy(sql`EXTRACT(MONTH FROM ${schema.bills.billDate})`);

    // Index the DB rows by month so we can emit a full Jan..Dec sequence with
    // zero-filled months that had no purchases.
    const byMonth = new Map<number, (typeof rows)[number]>();
    for (const r of rows) byMonth.set(Number(r.month), r);

    const months: PurchaseReportMonthRow[] = [];
    const totals: PurchaseReportTotals = {
      total: 0,
      paidOut: 0,
      payable: 0,
    };

    for (let m = 1; m <= 12; m++) {
      const r = byMonth.get(m);
      const total = Number(r?.total ?? 0);
      const paidOut = Number(r?.paidOut ?? 0);
      const payable = total - paidOut;

      months.push({ month: m, total, paidOut, payable });

      totals.total += total;
      totals.paidOut += paidOut;
      totals.payable += payable;
    }

    return { year, months, totals };
  }
}
