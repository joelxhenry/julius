/**
 * Well-known payment method code for "Store Credit".
 *
 * A store-credit payment is funded from the client's outstanding credit notes
 * rather than cash. The client bulk payment flow uses this code to switch a
 * cash payment into a credit-note draw-down (see PaymentTransactionService).
 */
export const STORE_CREDIT_METHOD_CODE = 'STORE_CREDIT';

/**
 * True when a payment method represents store credit (credit-note funded).
 * Matches on the canonical code first; falls back to an exact "store credit"
 * name so an existing, differently-coded method still resolves correctly.
 */
export function isStoreCreditMethod(method: { code?: string | null; name?: string | null }): boolean {
  return (
    method.code === STORE_CREDIT_METHOD_CODE ||
    (method.name ?? '').trim().toLowerCase() === 'store credit'
  );
}
