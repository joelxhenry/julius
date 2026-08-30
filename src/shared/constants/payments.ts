/**
 * Well-known payment method code for "Store Credit".
 *
 * A store-credit payment is funded from the client's outstanding credit notes
 * rather than cash. The client bulk payment flow uses this code to switch a
 * cash payment into a credit-note draw-down (see PaymentTransactionService).
 */
export const STORE_CREDIT_METHOD_CODE = 'STORE_CREDIT';

/** Well-known payment method code for plain cash. */
export const CASH_METHOD_CODE = 'CASH';

/**
 * The fixed set of payment types the Sales Report groups payments into, in the
 * order they should appear. Every payment is folded into one of these buckets by
 * `canonicalizePaymentType`, so the report only ever shows these types even when
 * the underlying payment records use varied or legacy method labels.
 */
export const CANONICAL_PAYMENT_TYPES = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'Credit/Debit Card',
  'Store Credit',
] as const;

export type CanonicalPaymentType = (typeof CANONICAL_PAYMENT_TYPES)[number];

/**
 * The stable lookup-table entry (code + display name) for each canonical payment
 * type. The Store Credit and Cash codes match their well-known constants so the
 * credit-note and cash-tendering flows keep working. Used by the seed that
 * normalizes legacy methods and by the UI pickers that offer them.
 */
export const CANONICAL_METHOD_BY_TYPE: Record<CanonicalPaymentType, { code: string; name: string }> = {
  Cash: { code: CASH_METHOD_CODE, name: 'Cash' },
  'Bank Transfer': { code: 'BANK_TRANSFER', name: 'Bank Transfer' },
  Cheque: { code: 'CHEQUE', name: 'Cheque' },
  'Credit/Debit Card': { code: 'CARD', name: 'Credit/Debit Card' },
  'Store Credit': { code: STORE_CREDIT_METHOD_CODE, name: 'Store Credit' },
};

/** The canonical payment method codes, in canonical display order. */
export const CANONICAL_PAYMENT_METHOD_CODES = CANONICAL_PAYMENT_TYPES.map(
  (t) => CANONICAL_METHOD_BY_TYPE[t].code
);

/** True when a label reads as a credit/debit-card payment. */
function isCardLabel(v: string): boolean {
  return (
    v.includes('card') ||
    v.includes('credit') ||
    v.includes('debit') ||
    v.includes('visa') ||
    v.includes('master') ||
    v.includes('pos')
  );
}

/**
 * Fold an arbitrary payment method code/name/label into one of the canonical
 * report payment types. Legacy data (migrated from the old system) uses varied
 * labels, so the order of checks matters:
 *
 *   1. Store credit / credit-note redemptions ("store credit", "credit note",
 *      "issue cr note") — matched first because they contain "credit", which
 *      would otherwise read as a card.
 *   2. Legacy "FROM:<source>" labels record the funding account. The source
 *      decides the bucket: FROM:CASH -> Cash, FROM:CREDIT CARD -> Card, and any
 *      bank/account reference (FROM:WIRE, FROM:NCB9076545, FROM:BNS013503) ->
 *      Bank Transfer, since a transfer from an account is a bank transfer.
 *   3. Plain cash, cheque, bank transfer, and card labels.
 *
 * Anything unrecognized falls back to Cash.
 */
export function canonicalizePaymentType(value: string | null | undefined): CanonicalPaymentType {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return 'Cash';

  if (
    (v.includes('store') && v.includes('credit')) ||
    v.includes('credit note') ||
    v.includes('cr note')
  ) {
    return 'Store Credit';
  }

  if (v.startsWith('from:')) {
    const inner = v.slice('from:'.length).trim();
    if (inner.includes('cash')) return 'Cash';
    if (inner.includes('cheque') || inner.includes('check')) return 'Cheque';
    if (isCardLabel(inner)) return 'Credit/Debit Card';
    return 'Bank Transfer';
  }

  if (v.includes('cash')) return 'Cash';
  if (v.includes('cheque') || v.includes('check')) return 'Cheque';
  if (v.includes('bank') || v.includes('transfer') || v.includes('wire') || v.includes('ach')) {
    return 'Bank Transfer';
  }
  if (isCardLabel(v)) return 'Credit/Debit Card';
  return 'Cash';
}

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

/**
 * True when a payment method represents plain cash. Matches on the canonical
 * code first, then an exact "cash" name so a differently-coded cash method still
 * resolves. Used to offer cash-tendering (handover / change due) in the payment
 * modals for cash payments only.
 */
export function isCashMethod(method: { code?: string | null; name?: string | null }): boolean {
  return (
    method.code === CASH_METHOD_CODE ||
    (method.name ?? '').trim().toLowerCase() === 'cash'
  );
}
