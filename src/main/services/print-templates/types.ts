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
