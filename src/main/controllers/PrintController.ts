import { PrintService, PrintResult } from '../services/PrintService';
import { PrintDocumentType, PrintOutputMode } from '../../shared/types/print';

export class PrintController {
  constructor(private printService: PrintService) {}

  private handleError(error: unknown) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Unknown print error',
    };
  }

  private wrapSuccess<T>(data: T) {
    return { success: true as const, data };
  }

  async printDocument(params: {
    documentType: PrintDocumentType;
    documentId: number;
    outputMode: PrintOutputMode;
    printerName?: string;
    copies?: number;
  }) {
    try {
      const result = await this.printService.generateDocument(
        params.documentType,
        params.documentId,
        params.outputMode,
        params.printerName,
        params.copies,
      );
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getAvailablePrinters() {
    try {
      const printers = await this.printService.getAvailablePrinters();
      return this.wrapSuccess(printers);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
