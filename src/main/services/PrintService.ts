import { BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import { SystemSettingsService, SystemSettingKeys } from './SystemSettingsService';
import { InvoiceService } from './InvoiceService';
import { QuotationService } from './QuotationService';
import { CreditNoteService } from './CreditNoteService';
import { PaymentService } from './PaymentService';
import { DocumentLineItemService } from './DocumentLineItemService';
import { EmployeeService } from './EmployeeService';
import { PrintDocumentType, PrintOutputMode } from '../../shared/types/print';
import {
  CompanyInfo,
  InvoiceTemplateData,
  QuotationTemplateData,
  CreditNoteTemplateData,
  PaymentReceiptTemplateData,
} from './print-templates/types';
import { getInvoiceTemplate } from './print-templates/invoiceTemplate';
import { getQuotationTemplate } from './print-templates/quotationTemplate';
import { getCreditNoteTemplate } from './print-templates/creditNoteTemplate';
import { getPaymentReceiptTemplate } from './print-templates/paymentReceiptTemplate';

export interface PrintResult {
  html?: string;
  pdfPath?: string;
  printed?: boolean;
  previewing?: boolean;
}

export class PrintService {
  private hiddenWindow: BrowserWindow | null = null;

  constructor(
    private systemSettingsService: SystemSettingsService,
    private invoiceService: InvoiceService,
    private quotationService: QuotationService,
    private creditNoteService: CreditNoteService,
    private paymentService: PaymentService,
    private documentLineItemService: DocumentLineItemService,
    private employeeService: EmployeeService,
  ) {}

  // --- Hidden window lifecycle ---

  private async getOrCreateHiddenWindow(): Promise<BrowserWindow> {
    if (this.hiddenWindow && !this.hiddenWindow.isDestroyed()) {
      return this.hiddenWindow;
    }

    this.hiddenWindow = new BrowserWindow({
      show: false,
      width: 816,
      height: 1056,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.hiddenWindow.on('closed', () => {
      this.hiddenWindow = null;
    });

    return this.hiddenWindow;
  }

  destroy(): void {
    if (this.hiddenWindow && !this.hiddenWindow.isDestroyed()) {
      this.hiddenWindow.close();
      this.hiddenWindow = null;
    }
  }

  // --- Company settings ---

  private async loadCompanyInfo(): Promise<CompanyInfo> {
    const [name, address, phone, email, trn, currCode, currSymbol, taxRate] = await Promise.all([
      this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_NAME),
      this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_ADDRESS),
      this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_PHONE),
      this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_EMAIL),
      this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_TRN),
      this.systemSettingsService.getValue(SystemSettingKeys.CURRENCY_CODE),
      this.systemSettingsService.getValue(SystemSettingKeys.CURRENCY_SYMBOL),
      this.systemSettingsService.getTaxRate(),
    ]);

    return {
      companyName: name || '',
      companyAddress: address || '',
      companyPhone: phone || '',
      companyEmail: email || '',
      companyTrn: trn || '',
      currencyCode: currCode || 'JMD',
      currencySymbol: currSymbol || '$',
      taxRate,
    };
  }

  // --- Resolve employee name by ID ---

  private async resolveEmployeeName(employeeId: number | null): Promise<string | null> {
    if (!employeeId) return null;
    try {
      const emp = await this.employeeService.findById(employeeId);
      if (!emp) return null;
      const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ');
      return name || (emp as any).code || null;
    } catch {
      return null;
    }
  }

  // --- Data loaders ---

  private async loadInvoiceData(id: number): Promise<InvoiceTemplateData> {
    const company = await this.loadCompanyInfo();
    const invoice = await this.invoiceService.findById(id);
    if (!invoice) throw new Error(`Invoice with ID ${id} not found`);

    const lineItems = await this.documentLineItemService.findByInvoice(invoice.invNumber);
    const salespersonName = await this.resolveEmployeeName(invoice.salespersonId);

    return {
      company,
      invoice: {
        invNumber: invoice.invNumber,
        invDate: invoice.invDate,
        clientName: invoice.clientName,
        clientAddress1: invoice.clientAddress1,
        clientAddress2: invoice.clientAddress2,
        clientPhone: invoice.clientPhone,
        reference: invoice.reference,
        notes: invoice.notes,
        subTotal: String(invoice.subTotal),
        tax: String(invoice.tax),
        total: String(invoice.total),
        totalPaid: String(invoice.totalPaid),
        status: invoice.status,
        creditTerms: invoice.creditTerms,
        pricing: invoice.pricing,
      },
      lineItems: lineItems.map((item, i) => ({
        lineNumber: i + 1,
        sku: item.sku,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discount: String(item.discount),
        amount: String(item.amount),
        isTaxable: item.isTaxable,
      })),
      salespersonName,
    };
  }

  private async loadQuotationData(id: number): Promise<QuotationTemplateData> {
    const company = await this.loadCompanyInfo();
    const quotation = await this.quotationService.findById(id);
    if (!quotation) throw new Error(`Quotation with ID ${id} not found`);

    const lineItems = await this.documentLineItemService.findByQuotation(quotation.quoteNum);
    const salespersonName = await this.resolveEmployeeName(quotation.salespersonId);

    return {
      company,
      quotation: {
        quoteNum: quotation.quoteNum,
        quoteDate: quotation.quoteDate,
        clientName: quotation.clientName,
        clientAddress1: quotation.clientAddress1,
        clientAddress2: quotation.clientAddress2,
        clientPhone: quotation.clientPhone,
        reference: quotation.reference,
        notes: quotation.notes,
        subTotal: String(quotation.subTotal),
        tax: String(quotation.tax),
        total: String(quotation.total),
        pricing: quotation.pricing,
      },
      lineItems: lineItems.map((item, i) => ({
        lineNumber: i + 1,
        sku: item.sku,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discount: String(item.discount),
        amount: String(item.amount),
        isTaxable: item.isTaxable,
      })),
      salespersonName,
    };
  }

  private async loadCreditNoteData(id: number): Promise<CreditNoteTemplateData> {
    const company = await this.loadCompanyInfo();
    const cn = await this.creditNoteService.findById(id);
    if (!cn) throw new Error(`Credit note with ID ${id} not found`);

    const lineItems = await this.documentLineItemService.findByCreditNote(cn.crNumber);
    const salespersonName = await this.resolveEmployeeName(cn.salespersonId);

    return {
      company,
      creditNote: {
        crNumber: cn.crNumber,
        crDate: cn.crDate,
        invNumber: cn.invNumber,
        clientName: cn.clientName,
        clientAddress1: cn.clientAddress1,
        clientAddress2: cn.clientAddress2,
        clientPhone: cn.clientPhone,
        reference: cn.reference,
        subTotal: String(cn.subTotal),
        tax: String(cn.tax),
        total: String(cn.total),
        totalUsed: String(cn.totalUsed),
        status: cn.status,
      },
      lineItems: lineItems.map((item, i) => ({
        lineNumber: i + 1,
        sku: item.sku,
        description: item.description,
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        discount: String(item.discount),
        amount: String(item.amount),
        isTaxable: item.isTaxable,
      })),
      salespersonName,
    };
  }

  private async loadPaymentData(id: number): Promise<PaymentReceiptTemplateData> {
    const company = await this.loadCompanyInfo();
    const payment = await this.paymentService.findById(id);
    if (!payment) throw new Error(`Payment with ID ${id} not found`);

    const processedByName = await this.resolveEmployeeName(payment.processedById);

    return {
      company,
      payment: {
        id: payment.id,
        documentType: payment.documentType,
        documentNumber: payment.documentNumber,
        invoiceNumber: payment.invoiceNumber,
        creditNoteNumber: payment.creditNoteNumber,
        payerName: payment.payerName,
        paymentDate: payment.paymentDate,
        paymentDesc: payment.paymentDesc,
        paymentDesc2: payment.paymentDesc2,
        amount: String(payment.amount),
        currency: payment.currency,
      },
      processedByName,
    };
  }

  // --- HTML generation ---

  private async generateHtml(documentType: PrintDocumentType, documentId: number): Promise<string> {
    switch (documentType) {
      case 'invoice': {
        const data = await this.loadInvoiceData(documentId);
        return getInvoiceTemplate(data);
      }
      case 'quotation': {
        const data = await this.loadQuotationData(documentId);
        return getQuotationTemplate(data);
      }
      case 'credit_note': {
        const data = await this.loadCreditNoteData(documentId);
        return getCreditNoteTemplate(data);
      }
      case 'payment_receipt': {
        const data = await this.loadPaymentData(documentId);
        return getPaymentReceiptTemplate(data);
      }
      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }
  }

  // --- Load HTML into hidden window and wait for render ---

  private async loadHtmlInWindow(win: BrowserWindow, html: string): Promise<void> {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  }

  // --- Public API ---

  async generateDocument(
    documentType: PrintDocumentType,
    documentId: number,
    outputMode: PrintOutputMode,
    printerName?: string,
    copies?: number,
  ): Promise<PrintResult> {
    const html = await this.generateHtml(documentType, documentId);

    if (outputMode === 'preview') {
      const previewWin = new BrowserWindow({
        width: 850,
        height: 1100,
        title: `Print Preview — ${documentType}`,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await previewWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      return { previewing: true };
    }

    if (outputMode === 'pdf') {
      const win = await this.getOrCreateHiddenWindow();
      await this.loadHtmlInWindow(win, html);

      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'Letter',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      });

      const saveResult = await dialog.showSaveDialog({
        title: 'Save as PDF',
        defaultPath: `${documentType}-${documentId}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return {};
      }

      fs.writeFileSync(saveResult.filePath, pdfData);
      return { pdfPath: saveResult.filePath };
    }

    if (outputMode === 'print') {
      const win = await this.getOrCreateHiddenWindow();
      await this.loadHtmlInWindow(win, html);

      return new Promise<PrintResult>((resolve) => {
        win.webContents.print(
          {
            silent: false,
            printBackground: true,
            deviceName: printerName || undefined,
            copies: copies || 1,
          },
          (success) => {
            resolve({ printed: success });
          },
        );
      });
    }

    throw new Error(`Unsupported output mode: ${outputMode}`);
  }

  async getAvailablePrinters(): Promise<Electron.PrinterInfo[]> {
    const win = await this.getOrCreateHiddenWindow();
    return win.webContents.getPrintersAsync();
  }
}
