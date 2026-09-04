import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull, isNotNull, inArray } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Backfill: unlink recycled-number garbage from legacy credit-note usage.
 *
 * In the legacy system, credit-note slip numbers (e.g. "CN1193") were REUSED
 * across the years. The import kept a single credit_notes row per number, but
 * every legacy payment that ever bore that number survived - so a note's Usage
 * Activity pulls in unrelated payments from other eras (different client, wildly
 * different amounts), and the per-row usage no longer matches the note's stored
 * total_used. This affected ~56% of legacy credit notes.
 *
 * Genuine legacy usage was recorded on the SAME date the note was issued
 * (payment_date == cr_date). We only touch a note when its same-date payments
 * already sum EXACTLY to total_used - proof that those rows are the complete,
 * authoritative usage - and then clear the credit_note_number link on every
 * other-date payment so it no longer shows as usage of that note. Notes whose
 * same-date rows don't reconcile (genuine split-date usage, or an off
 * total_used) are left completely untouched: we never strip genuine data.
 *
 * Scope guards keep this to legacy rows only. App-created CREDIT payments are
 * never candidates: credit-note *applications* set invoice_number, and every
 * app flow (applications and cash-out refunds) sets processed_by_id, whereas
 * legacy rows have both NULL.
 *
 * Idempotent: unlinked rows have credit_note_number = NULL and are excluded on
 * re-run, after which each touched note has only same-date rows left, so there
 * is nothing further to unlink.
 */

const CENT = 0.02; // reconciliation tolerance (currency rounding)

export async function seedUnlinkRecycledCreditNotePayments(
  db: NodePgDatabase<typeof schema>
): Promise<void> {
  // Legacy credit-note usage candidates: CREDIT payments still linked to a note,
  // with no invoice link and no processor (i.e. imported, not app-created).
  const candidates = await db
    .select({
      id: schema.payments.id,
      creditNoteNumber: schema.payments.creditNoteNumber,
      paymentDate: schema.payments.paymentDate,
      amount: schema.payments.amount,
    })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.documentType, 'CREDIT'),
        isNotNull(schema.payments.creditNoteNumber),
        isNull(schema.payments.invoiceNumber),
        isNull(schema.payments.processedById)
      )
    );

  if (candidates.length === 0) {
    console.log('seedUnlinkRecycledCreditNotePayments: no legacy credit-note payments to check');
    return;
  }

  // Note issue dates + authoritative used amounts, keyed by credit note number.
  const notes = await db
    .select({
      crNumber: schema.creditNotes.crNumber,
      crDate: schema.creditNotes.crDate,
      totalUsed: schema.creditNotes.totalUsed,
    })
    .from(schema.creditNotes);

  const noteByNumber = new Map(notes.map((n) => [n.crNumber, n]));

  // Group candidate payments by the note they claim to belong to.
  const byNote = new Map<string, typeof candidates>();
  for (const p of candidates) {
    const key = p.creditNoteNumber!;
    const list = byNote.get(key);
    if (list) list.push(p);
    else byNote.set(key, [p]);
  }

  const idsToUnlink: number[] = [];

  for (const [crNumber, group] of byNote) {
    const note = noteByNumber.get(crNumber);
    if (!note) continue; // dangling link; leave it for the FK/other cleanup

    const crDate = note.crDate; // 'YYYY-MM-DD'
    const totalUsed = parseFloat(note.totalUsed || '0');

    const sameDate = group.filter((p) => p.paymentDate === crDate);
    const otherDate = group.filter((p) => p.paymentDate !== crDate);
    if (otherDate.length === 0) continue; // nothing recycled to strip

    const sameDateSum = sameDate.reduce((s, p) => s + parseFloat(p.amount || '0'), 0);

    // Only strip when the issue-date rows already fully account for the note's
    // usage - then the other-date rows are provably not this note's usage.
    if (Math.abs(sameDateSum - totalUsed) < CENT) {
      for (const p of otherDate) idsToUnlink.push(p.id);
    }
  }

  if (idsToUnlink.length === 0) {
    console.log('seedUnlinkRecycledCreditNotePayments: no recycled credit-note links found, nothing to unlink');
    return;
  }

  // Unlink in chunks to keep the IN (...) lists a sane size.
  const CHUNK = 1000;
  for (let i = 0; i < idsToUnlink.length; i += CHUNK) {
    const chunk = idsToUnlink.slice(i, i + CHUNK);
    await db
      .update(schema.payments)
      .set({ creditNoteNumber: null })
      .where(inArray(schema.payments.id, chunk));
  }

  console.log(
    `seedUnlinkRecycledCreditNotePayments: unlinked ${idsToUnlink.length} recycled-number ` +
      `payment(s) from their credit notes so Usage Activity matches total_used`
  );
}
