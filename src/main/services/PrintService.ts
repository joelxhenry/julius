import { app, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService, SystemSettingKeys } from './SystemSettingsService';
import { InvoiceService } from './InvoiceService';
import { QuotationService } from './QuotationService';
import { CreditNoteService } from './CreditNoteService';
import { PaymentService, PaymentMethodService } from './PaymentService';
import { ClientService } from './ClientService';
import { DocumentLineItemService } from './DocumentLineItemService';
import { EmployeeService } from './EmployeeService';
import { PrintDocumentType, PrintOutputMode, PrintSettingsConfig, PrintFormat, ThermalPaperWidth, ReceivingReferenceRequest, ClientStatementRequest, PaymentReportRequest, SalesReportPrintRequest } from '../../shared/types/print';
import type { SalesSummaryResult } from './ReportService';
import {
  CompanyInfo,
  InvoiceTemplateData,
  QuotationTemplateData,
  CreditNoteTemplateData,
  PaymentReceiptTemplateData,
  ReceivingReferenceTemplateData,
  ClientStatementTemplateData,
  PaymentReportTemplateData,
  SalesReportTemplateData,
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
import { InventoryReceivingService } from './InventoryReceivingService';
import { getReceivingReferenceTemplate } from './print-templates/receivingReferenceTemplate';
import { getClientStatementTemplate } from './print-templates/clientStatementTemplate';
import { getPaymentReportTemplate } from './print-templates/paymentReportTemplate';
import { getSalesReportTemplate } from './print-templates/salesReportTemplate';
import { formatCurrency, formatDate } from './print-templates/baseStyles';
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
    private paymentMethodService: PaymentMethodService,
    private clientService: ClientService,
    private documentLineItemService: DocumentLineItemService,
    private employeeService: EmployeeService,
    private inventoryService: InventoryService,
    private variantService: VariantService,
    private inventoryReceivingService: InventoryReceivingService,
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
        title: `Thermal Preview - ${documentType}`,
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
        title: `Print Preview - ${documentType}`,
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

  // --- Standard (letter) HTML output ---

  private async outputStandardHtml(
    html: string,
    outputMode: PrintOutputMode,
    defaultFileName: string,
    title: string,
    printerName?: string,
    copies?: number,
  ): Promise<PrintResult> {
    if (outputMode === 'preview') {
      const previewWin = new BrowserWindow({
        width: 850,
        height: 1100,
        title,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
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
        defaultPath: `${defaultFileName}.pdf`,
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

  // --- Receiving reference report ---

  async generateReceivingReference(request: ReceivingReferenceRequest): Promise<PrintResult> {
    const data = await this.buildReceivingReferenceData(request.reference);
    const html = getReceivingReferenceTemplate(data);
    return this.outputStandardHtml(
      html,
      request.outputMode,
      `Receiving ${request.reference}`,
      `Receiving Report - ${request.reference}`,
      request.printerName,
    );
  }

  private formatReceivingCurrency(value: string | null, currency?: string | null): string {
    if (!value) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'US' ? 'USD' : 'JMD',
    }).format(num);
  }

  private async resolveReceivingDescription(record: {
    sku: string;
    variantSku: string | null;
  }): Promise<string> {
    if (record.variantSku) {
      const variant = await this.variantService.findByVariantSku(record.variantSku);
      if (variant) {
        const desc = variant.description || variant.variantName;
        if (desc) return desc;
        if (variant.parentSku) {
          const parent = await this.inventoryService.findBySku(variant.parentSku);
          const parentDesc = [parent?.description1, parent?.description2].filter(Boolean).join(' - ');
          if (parentDesc) return parentDesc;
        }
      }
      return record.variantSku;
    }

    const inv = await this.inventoryService.findBySku(record.sku);
    const desc = [inv?.description1, inv?.description2].filter(Boolean).join(' - ');
    return desc || record.sku;
  }

  private async buildReceivingReferenceData(reference: string): Promise<ReceivingReferenceTemplateData> {
    const company = await this.loadCompanyInfo();
    const records = await this.inventoryReceivingService.findByReference(reference);

    // Sort for a stable, readable report ordered by part number.
    const sorted = [...records].sort((a, b) => (a.variantSku || a.sku).localeCompare(b.variantSku || b.sku));

    // Distinct cost currencies drive whether a single total is meaningful.
    const currencies = new Set(
      sorted.filter((r) => r.lastCost != null).map((r) => (r.lastCostCurrency === 'US' ? 'US' : 'JA')),
    );
    const singleCurrency = currencies.size <= 1;
    const totalCurrency = sorted.find((r) => r.lastCost != null)?.lastCostCurrency ?? null;

    let totalQuantity = 0;
    let totalCost = 0;

    const items = await Promise.all(
      sorted.map(async (r) => {
        const qty = r.quantity ?? 0;
        const cost = r.lastCost != null ? parseFloat(r.lastCost) : NaN;
        const amount = !isNaN(cost) ? cost * qty : NaN;
        totalQuantity += qty;
        if (!isNaN(amount)) totalCost += amount;

        return {
          sku: r.variantSku || r.sku,
          description: await this.resolveReceivingDescription(r),
          quantity: qty.toLocaleString('en-US'),
          unitCost: this.formatReceivingCurrency(r.lastCost, r.lastCostCurrency),
          amount: !isNaN(amount)
            ? this.formatReceivingCurrency(amount.toFixed(2), r.lastCostCurrency)
            : '-',
        };
      }),
    );

    const latestDate = sorted.reduce<string | null>((max, r) => {
      const day = r.receivingDate ?? '';
      return day > (max ?? '') ? day : max;
    }, null);

    return {
      company,
      reference,
      supplier: sorted.find((r) => r.supplier)?.supplier ?? null,
      receivingDate: latestDate,
      printedAt: new Date().toLocaleString(),
      items,
      totalQuantity: totalQuantity.toLocaleString('en-US'),
      totalCost: singleCurrency
        ? this.formatReceivingCurrency(totalCost.toFixed(2), totalCurrency)
        : '-',
    };
  }

  // --- Client statement of account ---

  async generateClientStatement(request: ClientStatementRequest): Promise<PrintResult> {
    const data = await this.buildClientStatementData(request);
    const html = getClientStatementTemplate(data);
    const nameForFile = (data.client.clientName || `client-${request.clientId}`).replace(/[^\w-]+/g, '_');
    return this.outputStandardHtml(
      html,
      request.outputMode,
      `Statement ${nameForFile}`,
      `Statement of Account - ${data.client.clientName || request.clientId}`,
      request.printerName,
    );
  }

  // --- Client payment report ---

  async generatePaymentReport(request: PaymentReportRequest): Promise<PrintResult> {
    const data = await this.buildPaymentReportData(request);
    const html = getPaymentReportTemplate(data);
    const nameForFile = data.clientName.replace(/[^\w-]+/g, '_');
    return this.outputStandardHtml(
      html,
      request.outputMode,
      `Payments ${nameForFile}`,
      `Payment Report - ${data.clientName}`,
      request.printerName,
    );
  }

  // --- Sales report (period summary) ---

  /**
   * Render the period Sales Report. The aggregated figures are computed by
   * ReportService and passed in; this method only formats and lays them out.
   */
  async generateSalesReport(
    request: SalesReportPrintRequest,
    data: SalesSummaryResult,
  ): Promise<PrintResult> {
    const company = await this.loadCompanyInfo();
    const symbol = company.currencySymbol;
    const money = (v: number) => formatCurrency(v, symbol);
    const num = (v: number) => v.toLocaleString('en-US');

    const paymentTypesTotalCount = data.paymentTypes.reduce((s, t) => s + t.count, 0);
    const paymentTypesTotal = data.paymentTypes.reduce((s, t) => s + t.total, 0);

    const templateData: SalesReportTemplateData = {
      company,
      periodLabel: this.buildStatementPeriodLabel(request.startDate, request.endDate),
      printedAt: new Date().toLocaleString(),
      netSales: money(data.netSales),
      taxCollected: money(data.taxCollected),
      grossSales: money(data.grossSales),
      numCustomers: num(data.numCustomers),
      averageSale: money(data.averageSale),
      numPayments: num(data.numPayments),
      valuePayments: money(data.valuePayments),
      numRefunds: num(data.numRefunds),
      valueRefunds: money(data.valueRefunds),
      numDiscounts: num(data.numDiscounts),
      valueDiscounts: money(data.valueDiscounts),
      paymentTypes: data.paymentTypes.map((t) => ({
        method: t.method,
        count: num(t.count),
        total: money(t.total),
      })),
      paymentTypesTotalCount: num(paymentTypesTotalCount),
      paymentTypesTotal: money(paymentTypesTotal),
      detail: data.detail.map((d) => {
        const isNegative = d.amount < 0;
        return {
          invoiceNumber: d.invoiceNumber ?? '',
          paymentType: d.paymentType,
          clientName: d.clientName ?? '',
          date: d.date,
          amount: (isNegative ? '-' : '') + money(Math.abs(d.amount)),
          isNegative,
        };
      }),
    };

    const html = getSalesReportTemplate(templateData);
    return this.outputStandardHtml(
      html,
      request.outputMode,
      'Sales Report',
      'Sales Report',
      request.printerName,
    );
  }

  private async buildPaymentReportData(request: PaymentReportRequest): Promise<PaymentReportTemplateData> {
    const { clientId, paymentMethod, startDate, endDate } = request;
    const company = await this.loadCompanyInfo();
    const symbol = company.currencySymbol;

    const client = await this.clientService.findById(clientId);
    const clientName = request.clientName || client?.clientName || `Client ${clientId}`;

    // Match the on-screen Payments tab: same client + method + date filters,
    // fetched in full (not just the visible page).
    const [paymentsResult, paymentMethods] = await Promise.all([
      this.paymentService.findPaginated({
        clientId,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 1,
        pageSize: 100000,
      }),
      this.paymentMethodService.findAll(),
    ]);

    const methodMap = new Map<string, string>();
    paymentMethods.forEach((pm) => methodMap.set(pm.code, pm.name));

    const typeLabels: Record<string, string> = {
      INVOICE: 'Invoice',
      CREDIT: 'Credit Note',
      BILL: 'Bill',
    };

    let totalReceipts = 0;
    let totalRefunds = 0;

    const rows = paymentsResult.data.map((p) => {
      const num = parseFloat(p.amount || '0');
      if (num < 0) totalRefunds += Math.abs(num);
      else totalReceipts += num;

      // The method code lives in paymentDesc or paymentDesc2; notes live in
      // paymentDesc unless it held the code.
      const codeMatch = [p.paymentDesc, p.paymentDesc2].find((v) => v && methodMap.has(v)) || null;
      const method = codeMatch ? (methodMap.get(codeMatch) ?? '') : (p.paymentDesc ?? '');
      let notes = p.paymentDesc && !methodMap.has(p.paymentDesc) ? p.paymentDesc : '';
      if (notes && notes === method) notes = '';

      const isNegative = num < 0;
      return {
        date: p.paymentDate,
        type: typeLabels[p.documentType] || p.documentType,
        document: p.documentNumber,
        amount: (isNegative ? '-' : '') + formatCurrency(Math.abs(num), symbol),
        isNegative,
        method,
        reference: p.transactionReference || '',
        notes,
      };
    });

    return {
      company,
      clientName,
      periodLabel: this.buildStatementPeriodLabel(startDate, endDate),
      methodLabel: paymentMethod ? (methodMap.get(paymentMethod) || paymentMethod) : 'All Methods',
      printedAt: new Date().toLocaleString(),
      rows,
      count: rows.length,
      totalReceipts: formatCurrency(totalReceipts, symbol),
      totalRefunds: formatCurrency(totalRefunds, symbol),
      netTotal: formatCurrency(totalReceipts - totalRefunds, symbol),
    };
  }

  private buildStatementPeriodLabel(startDate?: string | null, endDate?: string | null): string {
    if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    if (startDate) return `From ${formatDate(startDate)}`;
    if (endDate) return `Through ${formatDate(endDate)}`;
    return 'All Time';
  }

  /** Positive = owed by the client; a credit balance is shown in parentheses. */
  private formatSignedCurrency(value: number, symbol: string): string {
    const formatted = formatCurrency(Math.abs(value), symbol);
    return value < 0 ? `(${formatted})` : formatted;
  }

  /**
   * Human-readable payment detail: the payment method (type), its transaction
   * reference, and any note. The method code is stored in either paymentDesc or
   * paymentDesc2, so we resolve whichever matches a known method and treat the
   * remaining descriptive fields as notes.
   */
  private buildPaymentDescription(
    p: { paymentDesc: string | null; paymentDesc2: string | null; transactionReference: string | null },
    methodMap: Map<string, string>,
  ): string {
    const codeMatch = [p.paymentDesc, p.paymentDesc2].find((v) => v && methodMap.has(v)) || null;
    const methodName = codeMatch ? (methodMap.get(codeMatch) ?? null) : (p.paymentDesc || null);

    const parts: string[] = [];
    const seen = new Set<string>();
    if (methodName) {
      parts.push(methodName);
      seen.add(methodName);
    }
    if (codeMatch) seen.add(codeMatch);
    if (p.transactionReference) {
      parts.push(`Ref: ${p.transactionReference}`);
      seen.add(p.transactionReference);
    }
    // Any leftover desc field that isn't the method code or already shown is a note.
    for (const v of [p.paymentDesc, p.paymentDesc2]) {
      if (v && !seen.has(v)) {
        parts.push(v);
        seen.add(v);
      }
    }
    return parts.join(' • ');
  }

  private async buildClientStatementData(request: ClientStatementRequest): Promise<ClientStatementTemplateData> {
    const { clientId, startDate, endDate } = request;
    const company = await this.loadCompanyInfo();
    const symbol = company.currencySymbol;

    const client = await this.clientService.findById(clientId);
    if (!client) throw new Error(`Client with ID ${clientId} not found`);

    // Fetch the full history; the date range is applied in-memory so we can
    // also compute the balance carried into the period.
    const [allInvoices, allPayments, allCreditNotes, paymentMethods] = await Promise.all([
      this.invoiceService.findByClient(clientId),
      this.paymentService.findByClient(clientId),
      this.creditNoteService.findByClient(clientId),
      this.paymentMethodService.findAll(),
    ]);

    const methodMap = new Map<string, string>(paymentMethods.map((m) => [m.code, m.name]));

    // Build a unified ledger of debits (increase what the client owes) and
    // credits (reduce it). Credit notes are shown as their own credit line, so
    // credit-note applications to invoices (payment documentType 'CREDIT') are
    // excluded to avoid double-counting.
    interface RawEntry {
      date: string | null;
      type: string;
      reference: string;
      description: string;
      debit: number;
      credit: number;
    }
    const raw: RawEntry[] = [];

    for (const inv of allInvoices) {
      if (inv.isArchived) continue;
      raw.push({
        date: inv.invDate,
        type: 'Invoice',
        reference: inv.invNumber,
        description: inv.reference || '',
        debit: parseFloat(inv.total) || 0,
        credit: 0,
      });
    }

    for (const p of allPayments) {
      if (p.documentType !== 'INVOICE') continue;
      raw.push({
        date: p.paymentDate,
        type: 'Payment',
        reference: p.documentNumber,
        description: this.buildPaymentDescription(p, methodMap),
        debit: 0,
        credit: parseFloat(p.amount) || 0,
      });
    }

    for (const cn of allCreditNotes) {
      if (cn.isArchived) continue;
      raw.push({
        date: cn.crDate,
        type: 'Credit Note',
        reference: cn.crNumber,
        description: cn.invNumber ? `Applied to ${cn.invNumber}` : (cn.reference || ''),
        debit: 0,
        credit: parseFloat(cn.total) || 0,
      });
    }

    // Chronological order drives the running balance.
    raw.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const before = (date: string | null): boolean => !!startDate && !!date && date < startDate;
    const inRange = (date: string | null): boolean => {
      if (!date) return true;
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      return true;
    };

    // Balance carried in from transactions before the period start.
    let openingBalanceNum = 0;
    for (const e of raw) {
      if (before(e.date)) openingBalanceNum += e.debit - e.credit;
    }

    let running = openingBalanceNum;
    let totalDebits = 0;
    let totalCredits = 0;
    const entries = raw
      .filter((e) => inRange(e.date))
      .map((e) => {
        running += e.debit - e.credit;
        totalDebits += e.debit;
        totalCredits += e.credit;
        return {
          date: e.date,
          type: e.type,
          reference: e.reference,
          description: e.description,
          debit: e.debit ? formatCurrency(e.debit, symbol) : '',
          credit: e.credit ? formatCurrency(e.credit, symbol) : '',
          balance: this.formatSignedCurrency(running, symbol),
        };
      });

    // Available credit is a current standing figure across all live credit notes.
    let availableCredit = 0;
    for (const cn of allCreditNotes) {
      if (cn.isArchived) continue;
      availableCredit += (parseFloat(cn.total) || 0) - (parseFloat(cn.totalUsed) || 0);
    }

    return {
      company,
      client: {
        clientName: client.clientName,
        clNumber: client.clNumber,
        address1: client.address1,
        address2: client.address2,
        phone: client.phone,
      },
      periodLabel: this.buildStatementPeriodLabel(startDate, endDate),
      printedAt: new Date().toLocaleString(),
      openingBalance: startDate ? this.formatSignedCurrency(openingBalanceNum, symbol) : null,
      entries,
      totals: {
        totalDebits: formatCurrency(totalDebits, symbol),
        totalCredits: formatCurrency(totalCredits, symbol),
        closingBalance: this.formatSignedCurrency(running, symbol),
        availableCredit: formatCurrency(availableCredit, symbol),
      },
    };
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

    if (request.source === 'inventory' && request.items && request.items.length > 0) {
      return {
        companyName,
        printedAt,
        sourceReference: request.sourceReference || '',
        items: request.items.map((it) => ({
          sku: it.sku,
          description: it.description || it.sku,
          location: it.location || '',
          quantity: it.quantity,
        })),
      };
    }

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

      // Prefer a variant's own location; fall back to the parent product's
      // location, then to the inventory item's location.
      const variant = await this.variantService.findByVariantSku(li.sku);
      if (variant) {
        location = variant.location || '';
        if (!location && variant.parentSku) {
          const parent = await this.inventoryService.findBySku(variant.parentSku);
          location = parent?.location || '';
        }
      } else {
        const invItem = await this.inventoryService.findBySku(li.sku);
        location = invItem?.location || '';
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
