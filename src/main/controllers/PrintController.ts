import { PrintService, PrintResult } from '../services/PrintService';
import { PrintDocumentType, PrintOutputMode, ReceivingReferenceRequest, ClientStatementRequest, PaymentReportRequest, SalesReportPrintRequest, PurchaseReportPrintRequest } from '../../shared/types/print';
import { LookupTicketRequest } from '../../shared/types/lookupTicket';
import type { SalesSummaryResult, PurchaseSummaryResult } from '../services/ReportService';

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

  async getPrintSettings() {
    try {
      const settings = await this.printService.getPrintSettings();
      return this.wrapSuccess(settings);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printLookupTicket(params: LookupTicketRequest) {
    try {
      const result = await this.printService.generateLookupTicket(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printReceivingReference(params: ReceivingReferenceRequest) {
    try {
      const result = await this.printService.generateReceivingReference(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printClientStatement(params: ClientStatementRequest) {
    try {
      const result = await this.printService.generateClientStatement(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printPaymentReport(params: PaymentReportRequest) {
    try {
      const result = await this.printService.generatePaymentReport(params);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printSalesReport(params: SalesReportPrintRequest, data: SalesSummaryResult) {
    try {
      const result = await this.printService.generateSalesReport(params, data);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async printPurchaseReport(params: PurchaseReportPrintRequest, data: PurchaseSummaryResult) {
    try {
      const result = await this.printService.generatePurchaseReport(params, data);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }
}
