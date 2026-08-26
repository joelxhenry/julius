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
