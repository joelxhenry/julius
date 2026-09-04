import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Backfill: reconcile the stored credit-note `status` with the real balance.
 *
 * Legacy notes were imported with status = 'A' (Active) regardless of how much
 * had been redeemed, so a fully-used note (total_used >= total) still reads as
 * Active in the stored column. The app derives the displayed badge from the
 * remaining balance, but the status FILTER queries this column directly - so an
 * "Active" filter surfaces notes the table renders as "Used", and the two
 * disagree.
 *
 * This restores the invariant the app displays: status = 'U' when the note is
 * fully redeemed (total_used >= total) and 'A' otherwise. `isArchived` is a
 * separate flag and is left untouched. Must run AFTER recomputeCreditNoteTotals,
 * which restores the real `total` this comparison depends on.
 *
 * Idempotent: once every row's status matches its balance, re-runs are a no-op.
 */
export async function seedReconcileCreditNoteStatus(db: NodePgDatabase<typeof schema>): Promise<void> {
  const updated = await db
    .update(schema.creditNotes)
    .set({
      status: sql`case when ${schema.creditNotes.totalUsed} >= ${schema.creditNotes.total} then 'U' else 'A' end`,
    })
    .where(
      sql`${schema.creditNotes.status} <> case when ${schema.creditNotes.totalUsed} >= ${schema.creditNotes.total} then 'U' else 'A' end`
    )
    .returning({ id: schema.creditNotes.id });

  if (updated.length === 0) {
    console.log('seedReconcileCreditNoteStatus: all credit-note statuses already match their balance, nothing to fix');
    return;
  }

  console.log(
    `seedReconcileCreditNoteStatus: reconciled status with balance on ${updated.length} credit note(s) ` +
      `so the status filter matches the displayed badge`
  );
}
