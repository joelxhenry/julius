import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema/index';

/**
 * Normalizes legacy credit-terms values to the numeric-days format the current
 * system expects.
 *
 * The legacy system stored free text in `credit_terms` - a mix of day counts
 * ("30 DAYS", "7 DAYS", "14 DAYS") and non-term values that were really payment
 * methods or notes ("CASH", "CHEQUE", "DEMO", and corrupted variants like
 * "DEMOAYS"). The new schema treats `credit_terms` as a number of days stored as
 * text (e.g. "30").
 *
 * This seeder strips the day count out of the old values:
 *   "30 DAYS" -> "30"     (leading integer extracted)
 *   "CASH"    -> NULL     (no number -> no term)
 *   "DEMOAYS" -> NULL
 *   "30"      -> "30"     (already numeric, left untouched)
 *
 * Idempotent: rows already holding a plain integer are excluded by the WHERE
 * clause, so re-running is a no-op. Values are trimmed first so " 30 DAYS" and
 * "30 DAYS " normalize correctly. Applied to both `clients` and `invoices`,
 * which each carry a `credit_terms` column copied from the client at sale time.
 */
export async function seedNormalizeCreditTerms(db: NodePgDatabase<typeof schema>): Promise<void> {
  console.log('Running credit-terms normalization seeder...');

  try {
    let totalNumeric = 0;
    let totalCleared = 0;

    for (const table of ['clients', 'invoices'] as const) {
      const ident = sql.identifier(table);

      // Rows needing work: non-null values that are not already a plain integer.
      // A leading integer (after trimming) becomes that integer; anything with no
      // leading digits collapses to NULL via substring's no-match behavior.
      const result = await db.execute(sql`
        UPDATE ${ident}
        SET credit_terms = substring(btrim(credit_terms) from '^[0-9]+')
        WHERE credit_terms IS NOT NULL
          AND btrim(credit_terms) !~ '^[0-9]+$'
        RETURNING credit_terms
      `);

      const rows = result.rows as { credit_terms: string | null }[];
      const numeric = rows.filter((r) => r.credit_terms !== null).length;
      const cleared = rows.length - numeric;
      totalNumeric += numeric;
      totalCleared += cleared;

      console.log(
        `  ${table}: ${rows.length} legacy value(s) normalized ` +
          `(${numeric} -> day count, ${cleared} -> null)`,
      );
    }

    console.log(
      `Credit-terms normalization complete: ${totalNumeric} converted to day counts, ` +
        `${totalCleared} non-numeric values cleared`,
    );
  } catch (error) {
    console.error('Credit-terms normalization seeder failed:', error);
    throw error;
  }
}
