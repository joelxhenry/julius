export type PrintDocumentType = 'invoice' | 'quotation' | 'credit_note' | 'payment_receipt';

export type PrintOutputMode = 'print' | 'preview' | 'pdf';

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
