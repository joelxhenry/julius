export interface CompanyInfo {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTrn: string;
  currencyCode: string;
  currencySymbol: string;
  taxRate: number;
  companyLogo?: string;
}

export interface PrintLineItem {
  lineNumber: number;
  sku: string | null;
  description: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  amount: string;
  isTaxable: boolean;
}

export interface InvoiceTemplateData {
  company: CompanyInfo;
  invoice: {
    invNumber: string;
    invDate: string;
    clientName: string | null;
    clientAddress1: string | null;
    clientAddress2: string | null;
    clientPhone: string | null;
    reference: string | null;
    notes: string | null;
    subTotal: string;
    tax: string;
    total: string;
    totalPaid: string;
    status: string;
    creditTerms: string | null;
    pricing: string;
  };
  lineItems: PrintLineItem[];
  salespersonName: string | null;
}

export interface QuotationTemplateData {
  company: CompanyInfo;
  quotation: {
    quoteNum: string;
    quoteDate: string;
    clientName: string | null;
    clientAddress1: string | null;
    clientAddress2: string | null;
    clientPhone: string | null;
    reference: string | null;
    notes: string | null;
    subTotal: string;
    tax: string;
    total: string;
    pricing: string;
  };
  lineItems: PrintLineItem[];
  salespersonName: string | null;
}

/** A single entry in a credit note's usage activity (how its funds were applied). */
export interface CreditNoteUsageItem {
  date: string | null;
  invoiceNumber: string | null;
  description: string | null;
  reference: string | null;
  /** Positive = drawn down (applied/refunded); negative = restored (void reversal). */
  amount: string;
}

export interface CreditNoteTemplateData {
  company: CompanyInfo;
  creditNote: {
    crNumber: string;
    crDate: string;
    invNumber: string | null;
    clientName: string | null;
    clientAddress1: string | null;
    clientAddress2: string | null;
    clientPhone: string | null;
    reference: string | null;
    subTotal: string;
    tax: string;
    total: string;
    totalUsed: string;
    status: string;
  };
  /** How the credit note's funds have been used (replaces the source line items). */
  usage: CreditNoteUsageItem[];
  salespersonName: string | null;
}

export interface ReceivingReferenceItem {
  sku: string;
  description: string;
  quantity: string;
  unitCost: string;
  amount: string;
}

export interface ReceivingReferenceTemplateData {
  company: CompanyInfo;
  reference: string;
  supplier: string | null;
  receivingDate: string | null;
  printedAt: string;
  items: ReceivingReferenceItem[];
  totalQuantity: string;
  totalCost: string;
}

export interface ClientStatementEntry {
  date: string | null;
  /** Transaction type label, e.g. "Invoice", "Payment", "Credit Note". */
  type: string;
  /** Source document number. */
  reference: string;
  description: string;
  /** Formatted debit amount (increases balance owed), or '' when not a debit. */
  debit: string;
  /** Formatted credit amount (reduces balance owed), or '' when not a credit. */
  credit: string;
  /** Formatted running balance after this entry. */
  balance: string;
}

export interface ClientStatementTemplateData {
  company: CompanyInfo;
  client: {
    clientName: string | null;
    clNumber: string | null;
    address1: string | null;
    address2: string | null;
    phone: string | null;
  };
  periodLabel: string;
  printedAt: string;
  /** Balance carried into the period; null for an all-time statement. */
  openingBalance: string | null;
  entries: ClientStatementEntry[];
  totals: {
    totalDebits: string;
    totalCredits: string;
    closingBalance: string;
    availableCredit: string;
  };
}

export interface PaymentReportRow {
  date: string | null;
  /** Document type label, e.g. "Invoice", "Credit Note". */
  type: string;
  /** Source document number. */
  document: string;
  /** Formatted amount, with a leading minus for refunds. */
  amount: string;
  /** True for refunds/voids (negative), so the template can style them. */
  isNegative: boolean;
  /** Payment method name. */
  method: string;
  /** Transaction reference. */
  reference: string;
  /** Free-text notes. */
  notes: string;
}

export interface PaymentReportTemplateData {
  company: CompanyInfo;
  clientName: string;
  periodLabel: string;
  methodLabel: string;
  printedAt: string;
  rows: PaymentReportRow[];
  count: number;
  totalReceipts: string;
  totalRefunds: string;
  netTotal: string;
}

export interface SalesReportPaymentTypeRow {
  method: string;
  count: string;
  total: string;
}

export interface SalesReportDetailRow {
  invoiceNumber: string;
  /** Payment method name, e.g. "CASH". */
  paymentType: string;
  clientName: string;
  /** Transaction reference ("Reference #"), or '' when none. */
  reference: string;
  /** Free-text payment notes, or '' when none. */
  notes: string;
  date: string | null;
  /** Formatted amount, with a leading minus for refunds. */
  amount: string;
  /** True for refunds (negative amounts). */
  isNegative: boolean;
}

/** A payment-type group in the sales listing, with its rows and subtotal. */
export interface SalesReportDetailGroup {
  /** Canonical payment type, e.g. "Cash". */
  type: string;
  /** Formatted count of payments in the group. */
  count: string;
  /** Formatted subtotal of the group's amounts. */
  subtotal: string;
  /** True when the group subtotal is negative. */
  subtotalNegative: boolean;
  rows: SalesReportDetailRow[];
}

export interface SalesReportTemplateData {
  company: CompanyInfo;
  periodLabel: string;
  printedAt: string;
  // Summary block
  netSales: string;
  taxCollected: string;
  grossSales: string;
  // Stats
  numCustomers: string;
  averageSale: string;
  numPayments: string;
  valuePayments: string;
  numRefunds: string;
  valueRefunds: string;
  numDiscounts: string;
  valueDiscounts: string;
  // Payment Report breakdown
  paymentTypes: SalesReportPaymentTypeRow[];
  paymentTypesTotalCount: string;
  paymentTypesTotal: string;
  // Per-payment detail listing, grouped by payment type
  detailGroups: SalesReportDetailGroup[];
  /** Total count of payments across all groups. */
  detailTotalCount: string;
  /**
   * When the listing is filtered to a subset of payment types, a human-readable
   * note of the included types (e.g. "Cash, Cheque"); empty when unfiltered.
   */
  detailFilterNote: string;
}

export interface PurchaseReportMonthRow {
  /** Month name, e.g. "January". */
  month: string;
  total: string;
  paidOut: string;
  payable: string;
}

export interface PurchaseReportTemplateData {
  company: CompanyInfo;
  /** Calendar year label, e.g. "2026". */
  year: string;
  printedAt: string;
  months: PurchaseReportMonthRow[];
  totals: {
    total: string;
    paidOut: string;
    payable: string;
  };
}

export interface PaymentReceiptTemplateData {
  company: CompanyInfo;
  payment: {
    id: number;
    documentType: string;
    documentNumber: string;
    invoiceNumber: string | null;
    creditNoteNumber: string | null;
    payerName: string | null;
    paymentDate: string | null;
    paymentDesc: string | null;
    paymentDesc2: string | null;
    amount: string;
    currency: string | null;
  };
  processedByName: string | null;
}
