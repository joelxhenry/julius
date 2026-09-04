import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Backfill: repair credit-note totals that were dropped in the legacy data.
 *
 * A large subset of imported credit notes carry a real sub_total and tax but a
 * `total` of 0 (or 0.01, or a stale partial value). The old system recorded the
 * return but never persisted the note's face value, so the app - which displays
 * `total` - shows the note as $0.00 / $0.00 / $0.00, making a genuine credit look
 * empty. ~1,555 notes are affected (~$11.2M of hidden face value).
 *
 * The fix restores the invariant total = sub_total + tax wherever it's currently
 * violated and the note actually has value (sub_total + tax > 0). `total_used` is
 * left as-is, so a never-redeemed note (total_used = 0) correctly shows its full
 * amount as remaining/redeemable again.
 *
 * We never wipe an existing total: notes with sub_total + tax = 0 but a nonzero
 * total (36 legacy rows with a face value and no line breakdown) are left alone.
 *
 * Idempotent: once total = sub_total + tax the row no longer matches, so re-runs
 * are a no-op.
 */
export async function seedRecomputeCreditNoteTotals(db: NodePgDatabase<typeof schema>): Promise<void> {
  const updated = await db
    .update(schema.creditNotes)
    .set({ total: sql`${schema.creditNotes.subTotal} + ${schema.creditNotes.tax}` })
    .where(
      sql`abs(${schema.creditNotes.total} - (${schema.creditNotes.subTotal} + ${schema.creditNotes.tax})) > 0.02
          and (${schema.creditNotes.subTotal} + ${schema.creditNotes.tax}) > 0`
    )
    .returning({ id: schema.creditNotes.id });

  if (updated.length === 0) {
    console.log('seedRecomputeCreditNoteTotals: all credit-note totals already consistent, nothing to fix');
    return;
  }

  console.log(
    `seedRecomputeCreditNoteTotals: restored total = sub_total + tax on ${updated.length} credit note(s) ` +
      `whose face value was missing from the legacy data`
  );
}
