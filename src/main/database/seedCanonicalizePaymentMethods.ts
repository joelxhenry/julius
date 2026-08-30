import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, isNull, notInArray, or } from 'drizzle-orm';
import * as schema from './schema/index';
import {
  CANONICAL_PAYMENT_TYPES,
  CANONICAL_METHOD_BY_TYPE,
  CANONICAL_PAYMENT_METHOD_CODES as CANONICAL_CODES,
  canonicalizePaymentType,
} from '../../shared/constants/payments';

/**
 * Normalize legacy payment method labels into the five canonical methods.
 *
 * The data migrated from the old system stores varied method labels directly on
 * each payment's `payment_desc` (e.g. "FROM:NCB9076545", "CREDIT CARD",
 * "ISSUE CR NOTE"). This backfill:
 *
 *   1. Ensures the five canonical methods exist in `payment_methods`.
 *   2. Rewrites each payment's `payment_desc` to the matching canonical code
 *      (via `canonicalizePaymentType`, the same rules the reports use), and
 *      preserves the original label in `transaction_reference` so the granular
 *      detail (which bank/account the money came from) is not lost.
 *
 * Idempotent: payments already carrying a canonical code are skipped, and an
 * existing transaction reference is never overwritten, so re-running is a no-op
 * once the data is normalized.
 */
export async function seedCanonicalizePaymentMethods(db: NodePgDatabase<typeof schema>): Promise<void> {
  // 1. Ensure the canonical methods exist in the lookup table.
  for (const type of CANONICAL_PAYMENT_TYPES) {
    const { code, name } = CANONICAL_METHOD_BY_TYPE[type];
    await db
      .insert(schema.paymentMethods)
      .values({ code, name, active: true })
      .onConflictDoUpdate({
        target: schema.paymentMethods.code,
        set: { name, active: true },
      });
  }

  // Deactivate any legacy method rows left over from the old system. They carry
  // the same display names as the canonical methods (under different codes), so
  // leaving them active duplicates every entry in the payment-method pickers.
  await db
    .update(schema.paymentMethods)
    .set({ active: false })
    .where(notInArray(schema.paymentMethods.code, CANONICAL_CODES));

  // 2. Fetch payments whose method isn't already a canonical code.
  const pending = await db
    .select()
    .from(schema.payments)
    .where(
      or(
        isNull(schema.payments.paymentDesc),
        notInArray(schema.payments.paymentDesc, CANONICAL_CODES),
      ),
    );

  let updated = 0;
  const buckets: Record<string, number> = {};

  for (const payment of pending) {
    // The legacy label lives in payment_desc (fall back to payment_desc2).
    const rawLabel = (payment.paymentDesc ?? payment.paymentDesc2 ?? '').trim();
    if (!rawLabel) continue;

    const type = canonicalizePaymentType(rawLabel);
    const { code, name } = CANONICAL_METHOD_BY_TYPE[type];

    const set: { paymentDesc: string; transactionReference?: string } = { paymentDesc: code };

    // Preserve the original label as the reference when it carries detail beyond
    // the canonical method name and there is no existing reference to clobber.
    const carriesDetail = rawLabel.toLowerCase() !== name.toLowerCase();
    const hasExistingReference = !!payment.transactionReference?.trim();
    if (carriesDetail && !hasExistingReference) {
      set.transactionReference = rawLabel;
    }

    await db.update(schema.payments).set(set).where(eq(schema.payments.id, payment.id));

    updated += 1;
    buckets[type] = (buckets[type] ?? 0) + 1;
  }

  if (updated === 0) {
    console.log('seedCanonicalizePaymentMethods: no legacy payment labels to normalize');
    return;
  }

  const summary = Object.entries(buckets)
    .map(([type, n]) => `${type}: ${n}`)
    .join(', ');
  console.log(`seedCanonicalizePaymentMethods: normalized ${updated} payment(s) (${summary})`);
}
