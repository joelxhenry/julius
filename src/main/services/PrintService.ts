import { app, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService, SystemSettingKeys } from './SystemSettingsService';
import { InvoiceService } from './InvoiceService';
import { QuotationService } from './QuotationService';
import { CreditNoteService } from './CreditNoteService';
import { PaymentService } from './PaymentService';
import { DocumentLineItemService } from './DocumentLineItemService';
import { EmployeeService } from './EmployeeService';
import { PrintDocumentType, PrintOutputMode, PrintSettingsConfig, PrintFormat, ThermalPaperWidth } from '../../shared/types/print';
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
import { getThermalInvoiceTemplate } from './print-templates/thermal/thermalInvoiceTemplate';
import { getThermalQuotationTemplate } from './print-templates/thermal/thermalQuotationTemplate';
import { getThermalCreditNoteTemplate } from './print-templates/thermal/thermalCreditNoteTemplate';
import { getThermalPaymentReceiptTemplate } from './print-templates/thermal/thermalPaymentReceiptTemplate';
import { getThermalLookupTicketTemplate } from './print-templates/thermal/thermalLookupTicketTemplate';
import { InventoryService } from './InventoryService';
import { VariantService } from './VariantService';
import { LookupTicketRequest, LookupTicketData, LookupTicketItem } from '../../shared/types/lookupTicket';

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
    private inventoryService: InventoryService,
    private variantService: VariantService,
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

    let companyLogo: string | undefined;
    try {
      const logoPath = app.isPackaged
        ? path.join(process.resourcesPath, 'icon.png')
        : path.join(__dirname, '../../resources/icon.png');
      const buf = fs.readFileSync(logoPath);
      companyLogo = `data:image/png;base64,${buf.toString('base64')}`;
    } catch {
      // Logo file unavailable, skip
    }

    return {
      companyName: name || '',
      companyAddress: address || '',
      companyPhone: phone || '',
      companyEmail: email || '',
      companyTrn: trn || '',
      currencyCode: currCode || 'JMD',
      currencySymbol: currSymbol || '$',
      taxRate,
      companyLogo,
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

  // --- Print settings ---

  private async loadPrintSettings(): Promise<PrintSettingsConfig> {
    const [fmtInv, fmtQuo, fmtCn, fmtPay, paperWidth, printerName] = await Promise.all([
      this.systemSettingsService.getValue(SystemSettingKeys.PRINT_FORMAT_INVOICE),
      this.systemSettingsService.getValue(SystemSettingKeys.PRINT_FORMAT_QUOTATION),
      this.systemSettingsService.getValue(SystemSettingKeys.PRINT_FORMAT_CREDIT_NOTE),
      this.systemSettingsService.getValue(SystemSettingKeys.PRINT_FORMAT_PAYMENT_RECEIPT),
      this.systemSettingsService.getValue(SystemSettingKeys.THERMAL_PAPER_WIDTH),
      this.systemSettingsService.getValue(SystemSettingKeys.THERMAL_PRINTER_NAME),
    ]);

    return {
      documentFormats: {
        invoice: (fmtInv as PrintFormat) || 'standard',
        quotation: (fmtQuo as PrintFormat) || 'standard',
        credit_note: (fmtCn as PrintFormat) || 'standard',
        payment_receipt: (fmtPay as PrintFormat) || 'standard',
      },
      thermalPaperWidth: (paperWidth as ThermalPaperWidth) || '80mm',
      thermalPrinterName: printerName || '',
    };
  }

  async getPrintSettings(): Promise<PrintSettingsConfig> {
    return this.loadPrintSettings();
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

  private async generateThermalHtml(
    documentType: PrintDocumentType,
    documentId: number,
    paperWidth: ThermalPaperWidth,
  ): Promise<string> {
    switch (documentType) {
      case 'invoice': {
        const data = await this.loadInvoiceData(documentId);
        return getThermalInvoiceTemplate(data, paperWidth);
      }
      case 'quotation': {
        const data = await this.loadQuotationData(documentId);
        return getThermalQuotationTemplate(data, paperWidth);
      }
      case 'credit_note': {
        const data = await this.loadCreditNoteData(documentId);
        return getThermalCreditNoteTemplate(data, paperWidth);
      }
      case 'payment_receipt': {
        const data = await this.loadPaymentData(documentId);
        return getThermalPaymentReceiptTemplate(data, paperWidth);
      }
      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }
  }

  private async generateThermalDocument(
    documentType: PrintDocumentType,
    documentId: number,
    outputMode: PrintOutputMode,
    settings: PrintSettingsConfig,
    copies?: number,
  ): Promise<PrintResult> {
    if (outputMode === 'pdf') {
      throw new Error('PDF export is not supported for thermal format. Use print or preview instead.');
    }

    const html = await this.generateThermalHtml(documentType, documentId, settings.thermalPaperWidth);
    const previewWidth = settings.thermalPaperWidth === '80mm' ? 360 : 280;

    if (outputMode === 'preview') {
      const previewWin = new BrowserWindow({
        width: previewWidth,
        height: 700,
        title: `Thermal Preview — ${documentType}`,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      await previewWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      return { previewing: true };
    }

    // Print mode
    const win = await this.getOrCreateHiddenWindow();
    await this.loadHtmlInWindow(win, html);

    const useSilent = !!settings.thermalPrinterName;

    return new Promise<PrintResult>((resolve) => {
      win.webContents.print(
        {
          silent: useSilent,
          printBackground: true,
          deviceName: settings.thermalPrinterName || undefined,
          copies: copies || 1,
        },
        (success) => {
          resolve({ printed: success });
        },
      );
    });
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
    // Check if this document type is configured for thermal printing
    const settings = await this.loadPrintSettings();
    if (settings.documentFormats[documentType] === 'thermal') {
      return this.generateThermalDocument(documentType, documentId, outputMode, settings, copies);
    }

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

  // --- Lookup Ticket ---

  async generateLookupTicket(request: LookupTicketRequest): Promise<PrintResult> {
    const settings = await this.loadPrintSettings();
    const companyName = (await this.systemSettingsService.getValue(SystemSettingKeys.COMPANY_NAME)) || '';
    const data = await this.buildLookupTicketData(request, companyName);
    const html = getThermalLookupTicketTemplate(data, settings.thermalPaperWidth);
    const previewWidth = settings.thermalPaperWidth === '80mm' ? 360 : 280;

    if (request.outputMode === 'preview') {
      const previewWin = new BrowserWindow({
        width: previewWidth,
        height: 700,
        title: 'Lookup Ticket Preview',
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      });
      await previewWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      return { previewing: true };
    }

    // Print mode
    const win = await this.getOrCreateHiddenWindow();
    await this.loadHtmlInWindow(win, html);
    const useSilent = !!settings.thermalPrinterName;

    return new Promise<PrintResult>((resolve) => {
      win.webContents.print(
        {
          silent: useSilent,
          printBackground: true,
          deviceName: settings.thermalPrinterName || undefined,
          copies: 1,
        },
        (success) => {
          resolve({ printed: success });
        },
      );
    });
  }

  private async buildLookupTicketData(
    request: LookupTicketRequest,
    companyName: string,
  ): Promise<LookupTicketData> {
    const printedAt = new Date().toLocaleString();

    if (request.source === 'inventory' && request.inventoryItem) {
      const inv = request.inventoryItem;
      const desc = [inv.description1, inv.description2].filter(Boolean).join(' - ');
      return {
        companyName,
        printedAt,
        sourceReference: request.sourceReference || `Item ${inv.sku}`,
        items: [{
          sku: inv.sku,
          description: desc || inv.sku,
          location: inv.location || '',
          quantity: inv.quantity,
        }],
      };
    }

    if (request.source === 'invoice' && request.invoiceId) {
      const invoice = await this.invoiceService.findById(request.invoiceId);
      if (!invoice) throw new Error(`Invoice with ID ${request.invoiceId} not found`);
      const lineItems = await this.documentLineItemService.findByInvoice(invoice.invNumber);
      const items = await this.resolveLocations(lineItems);
      return {
        companyName,
        printedAt,
        sourceReference: request.sourceReference || `Invoice #${invoice.invNumber}`,
        items,
      };
    }

    if (request.source === 'quotation' && request.quotationId) {
      const quotation = await this.quotationService.findById(request.quotationId);
      if (!quotation) throw new Error(`Quotation with ID ${request.quotationId} not found`);
      const lineItems = await this.documentLineItemService.findByQuotation(quotation.quoteNum);
      const items = await this.resolveLocations(lineItems);
      return {
        companyName,
        printedAt,
        sourceReference: request.sourceReference || `Quote #${quotation.quoteNum}`,
        items,
      };
    }

    return { companyName, printedAt, sourceReference: request.sourceReference || '', items: [] };
  }

  private async resolveLocations(
    lineItems: Array<{ sku: string; description: string | null; quantity: number }>,
  ): Promise<LookupTicketItem[]> {
    const results: LookupTicketItem[] = [];

    for (const li of lineItems) {
      if (!li.sku) {
        results.push({ sku: '', description: li.description || '', location: '', quantity: li.quantity });
        continue;
      }

      let location = '';

      // Try inventory item first
      const invItem = await this.inventoryService.findBySku(li.sku);
      if (invItem) {
        location = invItem.location || '';
      } else {
        // Try variant — resolve parent's location
        const variant = await this.variantService.findByVariantSku(li.sku);
        if (variant && variant.parentSku) {
          const parent = await this.inventoryService.findBySku(variant.parentSku);
          if (parent) {
            location = parent.location || '';
          }
        }
      }

      results.push({
        sku: li.sku,
        description: li.description || li.sku,
        location,
        quantity: li.quantity,
      });
    }

    return results;
  }
}
