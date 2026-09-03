export type PrintDocumentType = 'invoice' | 'quotation' | 'credit_note' | 'payment_receipt';

export type PrintOutputMode = 'print' | 'preview' | 'pdf';

export type PrintFormat = 'standard' | 'thermal';

export type ThermalPaperWidth = '80mm' | '58mm';

export interface PrintDocumentRequest {
  documentType: PrintDocumentType;
  documentId: number;
  outputMode: PrintOutputMode;
  printerName?: string;
  copies?: number;
}

export interface PrintDocumentResponse {
  html?: string;
  pdfPath?: string;
  printed?: boolean;
  previewing?: boolean;
}

export interface PrintSettingsConfig {
  documentFormats: Record<PrintDocumentType, PrintFormat>;
  thermalPaperWidth: ThermalPaperWidth;
  thermalPrinterName: string;
}

export interface ReceivingReferenceRequest {
  reference: string;
  outputMode: PrintOutputMode;
  printerName?: string;
}

export interface ClientStatementRequest {
  clientId: number;
  /** Inclusive start date (YYYY-MM-DD). Omit for an all-time statement. */
  startDate?: string | null;
  /** Inclusive end date (YYYY-MM-DD). Omit for an all-time statement. */
  endDate?: string | null;
  outputMode: PrintOutputMode;
  printerName?: string;
}

export interface SalesReportPrintRequest {
  /** Inclusive start date (YYYY-MM-DD). Omit for all dates. */
  startDate?: string | null;
  /** Inclusive end date (YYYY-MM-DD). Omit for all dates. */
  endDate?: string | null;
  /**
   * Canonical payment types to include in the sales listing. Omit (or leave
   * empty) to include every type. The summary/Payment Report aggregates are
   * unaffected by this filter.
   */
  paymentTypes?: string[];
  outputMode: PrintOutputMode;
  printerName?: string;
}

export interface PurchaseReportPrintRequest {
  /** Calendar year to report on. */
  year: number;
  outputMode: PrintOutputMode;
  printerName?: string;
}

export interface PaymentReportRequest {
  clientId: number;
  /** Client display name for the report heading / file name. */
  clientName?: string | null;
  /** Payment-method code filter; omit for all methods. */
  paymentMethod?: string | null;
  /** Inclusive start date (YYYY-MM-DD). */
  startDate?: string | null;
  /** Inclusive end date (YYYY-MM-DD). */
  endDate?: string | null;
  outputMode: PrintOutputMode;
  printerName?: string;
}
