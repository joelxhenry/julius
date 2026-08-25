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
