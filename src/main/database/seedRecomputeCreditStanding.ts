import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';
import { computeReceivablesAging, applyCreditStanding } from '../services/receivablesAging';

/**
 * Refreshes every client's auto-maintained credit-standing flag
 * (`clients.is_in_arrears`) from the current receivables.
 *
 * A client is "in arrears" when they hold any outstanding amount past their
 * allowed credit terms. This runs at startup (and again whenever the receivables
 * report is generated) so the flag shown on the account stays current without
 * wiring every invoice/payment mutation.
 *
 * Idempotent: only clients whose stored flag differs from the freshly computed
 * value are written, so a no-change run touches zero rows.
 */
export async function seedRecomputeCreditStanding(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running credit-standing recompute seeder...');

  try {
    const summary = await computeReceivablesAging(db);
    const { inArrears, updated } = await applyCreditStanding(db, summary);
    console.log(
      `Credit-standing recompute complete: ${inArrears} client(s) in arrears, ${updated} flag(s) changed`,
    );
  } catch (error) {
    console.error('Credit-standing recompute seeder failed:', error);
    throw error;
  }
}
