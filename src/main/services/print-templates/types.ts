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
  lineItems: PrintLineItem[];
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
