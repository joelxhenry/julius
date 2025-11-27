import { ipcMain } from 'electron';
import { getDatabaseOrNull, initDatabase, closeDatabase } from '../database';
import { IpcChannel } from '../../shared/types/ipc';

// Import services
import {
  ClientService,
  UserService,
  PartService,
  PartVariantService,
  InvoiceService,
  InvoiceItemService,
  PaymentService,
  PaymentMethodService,
  QuotationService,
  QuotationItemService,
  CreditNoteService,
  CreditNoteAllocationService,
} from '../services';

// Import controllers
import {
  ClientController,
  UserController,
  PartController,
  PartVariantController,
  InvoiceController,
  InvoiceItemController,
  PaymentController,
  PaymentMethodController,
  QuotationController,
  QuotationItemController,
  CreditNoteController,
  CreditNoteAllocationController,
} from '../controllers';

import { DatabaseSettingsService } from '../services/DatabaseSettingsService';
import { DatabaseSettingsController } from '../controllers/DatabaseSettingsController';

export function registerIpcHandlers() {
  // Database configuration handlers (always available)
  const settingsService = new DatabaseSettingsService();
  const settingsController = new DatabaseSettingsController(settingsService);

  ipcMain.handle(IpcChannel.GET_DATABASE_CONFIG, () =>
    settingsController.getConfig()
  );

  ipcMain.handle(IpcChannel.UPDATE_DATABASE_CONFIG, (_, configData) =>
    settingsController.updateConfig(configData)
  );

  ipcMain.handle(IpcChannel.TEST_DATABASE_CONNECTION, (_, configData) =>
    settingsController.testConnection(configData)
  );

  ipcMain.handle(IpcChannel.RECONNECT_DATABASE, async () => {
    try {
      await closeDatabase();
      const newDb = await initDatabase();
      if (newDb) {
        // Re-register all handlers with new db instance
        registerIpcHandlers();
        return { success: true };
      }
      return { success: false, error: 'Connection failed' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Get database instance (may be null)
  const db = getDatabaseOrNull();

  // Only register data handlers if database is available
  if (!db) {
    console.warn('Database not available, data handlers not registered');
    return;
  }

  // Initialize services
  const clientService = new ClientService(db);
  const userService = new UserService(db);
  const partService = new PartService(db);
  const partVariantService = new PartVariantService(db);
  const invoiceService = new InvoiceService(db);
  const invoiceItemService = new InvoiceItemService(db);
  const paymentService = new PaymentService(db);
  const paymentMethodService = new PaymentMethodService(db);
  const quotationService = new QuotationService(db);
  const quotationItemService = new QuotationItemService(db);
  const creditNoteService = new CreditNoteService(db);
  const creditNoteAllocationService = new CreditNoteAllocationService(db);

  // Initialize controllers
  const clientController = new ClientController(clientService);
  const userController = new UserController(userService);
  const partController = new PartController(partService);
  const partVariantController = new PartVariantController(partVariantService);
  const invoiceController = new InvoiceController(invoiceService);
  const invoiceItemController = new InvoiceItemController(invoiceItemService);
  const paymentController = new PaymentController(paymentService);
  const paymentMethodController = new PaymentMethodController(paymentMethodService);
  const quotationController = new QuotationController(quotationService);
  const quotationItemController = new QuotationItemController(quotationItemService);
  const creditNoteController = new CreditNoteController(creditNoteService);
  const creditNoteAllocationController = new CreditNoteAllocationController(creditNoteAllocationService);

  // ===== CLIENT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CLIENTS, () => clientController.getAll());
  ipcMain.handle(IpcChannel.GET_CLIENT, (_, { id }: { id: number }) => clientController.getById(id));
  ipcMain.handle(IpcChannel.GET_CLIENT_BY_EMAIL, (_, { email }: { email: string }) => clientController.getByEmail(email));
  ipcMain.handle(IpcChannel.SEARCH_CLIENTS, (_, { query }: { query: string }) => clientController.search(query));
  ipcMain.handle(IpcChannel.CREATE_CLIENT, (_, data: any) => clientController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CLIENT, (_, { id, data }: any) => clientController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CLIENT, (_, { id }: { id: number }) => clientController.delete(id));

  // ===== USER HANDLERS =====
  ipcMain.handle(IpcChannel.GET_USERS, () => userController.getAll());
  ipcMain.handle(IpcChannel.GET_USER, (_, { id }: { id: number }) => userController.getById(id));
  ipcMain.handle(IpcChannel.GET_USER_BY_USERNAME, (_, { username }: { username: string }) => userController.getByUsername(username));
  ipcMain.handle(IpcChannel.GET_ACTIVE_USERS, () => userController.getActive());
  ipcMain.handle(IpcChannel.SEARCH_USERS, (_, { query }: { query: string }) => userController.search(query));
  ipcMain.handle(IpcChannel.CREATE_USER, (_, data: any) => userController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_USER, (_, { id, data }: any) => userController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_USER, (_, { id }: { id: number }) => userController.delete(id));

  // ===== PART HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PARTS, () => partController.getAll());
  ipcMain.handle(IpcChannel.GET_PART, (_, { id }: { id: number }) => partController.getById(id));
  ipcMain.handle(IpcChannel.GET_PART_BY_SKU, (_, { sku }: { sku: string }) => partController.getBySku(sku));
  ipcMain.handle(IpcChannel.SEARCH_PARTS, (_, { query }: { query: string }) => partController.search(query));
  ipcMain.handle(IpcChannel.CREATE_PART, (_, data: any) => partController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_PART, (_, { id, data }: any) => partController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PART, (_, { id }: { id: number }) => partController.delete(id));

  // ===== PART VARIANT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PART_VARIANTS, () => partVariantController.getAll());
  ipcMain.handle(IpcChannel.GET_PART_VARIANT, (_, { id }: { id: number }) => partVariantController.getById(id));
  ipcMain.handle(IpcChannel.GET_VARIANTS_BY_PART, (_, { partId }: { partId: number }) => partVariantController.getByPartId(partId));
  ipcMain.handle(IpcChannel.GET_ACTIVE_VARIANTS, (_, { partId }: { partId?: number }) => partVariantController.getActive(partId));
  ipcMain.handle(IpcChannel.GET_LOW_STOCK_VARIANTS, () => partVariantController.getLowStock());
  ipcMain.handle(IpcChannel.CREATE_PART_VARIANT, (_, data: any) => partVariantController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_PART_VARIANT, (_, { id, data }: any) => partVariantController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PART_VARIANT, (_, { id }: { id: number }) => partVariantController.delete(id));
  ipcMain.handle(IpcChannel.UPDATE_VARIANT_STOCK, (_, { id, quantity }: { id: number; quantity: number }) => partVariantController.updateStock(id, quantity));

  // ===== INVOICE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVOICES, () => invoiceController.getAll());
  ipcMain.handle(IpcChannel.GET_INVOICE, (_, { id }: { id: number }) => invoiceController.getById(id));
  ipcMain.handle(IpcChannel.GET_INVOICES_BY_CLIENT, (_, { clientId }: { clientId: number }) => invoiceController.getByClient(clientId));
  ipcMain.handle(IpcChannel.GET_UNPAID_INVOICES, () => invoiceController.getUnpaid());
  ipcMain.handle(IpcChannel.CREATE_INVOICE, (_, data: any) => invoiceController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_INVOICE, (_, { id, data }: any) => invoiceController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_INVOICE, (_, { id }: { id: number }) => invoiceController.delete(id));
  ipcMain.handle(IpcChannel.RECORD_PAYMENT, (_, { id, amount }: { id: number; amount: number }) => invoiceController.recordPayment(id, amount));

  // ===== INVOICE ITEM HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVOICE_ITEMS, (_, { invoiceId }: { invoiceId: number }) => invoiceItemController.getByInvoice(invoiceId));
  ipcMain.handle(IpcChannel.CREATE_INVOICE_ITEM, (_, data: any) => invoiceItemController.create(data));
  ipcMain.handle(IpcChannel.CREATE_INVOICE_ITEMS_BULK, (_, { items }: { items: any[] }) => invoiceItemController.bulkCreate(items));
  ipcMain.handle(IpcChannel.UPDATE_INVOICE_ITEM, (_, { id, data }: any) => invoiceItemController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_INVOICE_ITEM, (_, { id }: { id: number }) => invoiceItemController.delete(id));

  // ===== PAYMENT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PAYMENTS, () => paymentController.getAll());
  ipcMain.handle(IpcChannel.GET_PAYMENT, (_, { id }: { id: number }) => paymentController.getById(id));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_INVOICE, (_, { invoiceId }: { invoiceId: number }) => paymentController.getByInvoice(invoiceId));
  ipcMain.handle(IpcChannel.CREATE_PAYMENT, (_, data: any) => paymentController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_PAYMENT, (_, { id, data }: any) => paymentController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PAYMENT, (_, { id }: { id: number }) => paymentController.delete(id));

  // ===== PAYMENT METHOD HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PAYMENT_METHODS, () => paymentMethodController.getAll());
  ipcMain.handle(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, () => paymentMethodController.getActive());
  ipcMain.handle(IpcChannel.CREATE_PAYMENT_METHOD, (_, data: any) => paymentMethodController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_PAYMENT_METHOD, (_, { id, data }: any) => paymentMethodController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PAYMENT_METHOD, (_, { id }: { id: number }) => paymentMethodController.delete(id));

  // ===== QUOTATION HANDLERS =====
  ipcMain.handle(IpcChannel.GET_QUOTATIONS, () => quotationController.getAll());
  ipcMain.handle(IpcChannel.GET_QUOTATION, (_, { id }: { id: number }) => quotationController.getById(id));
  ipcMain.handle(IpcChannel.GET_QUOTATIONS_BY_CLIENT, (_, { clientId }: { clientId: number }) => quotationController.getByClient(clientId));
  ipcMain.handle(IpcChannel.CREATE_QUOTATION, (_, data: any) => quotationController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_QUOTATION, (_, { id, data }: any) => quotationController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_QUOTATION, (_, { id }: { id: number }) => quotationController.delete(id));
  ipcMain.handle(IpcChannel.CONVERT_QUOTATION_TO_INVOICE, (_, { id }: { id: number }) => quotationController.convertToInvoice(id));

  // ===== QUOTATION ITEM HANDLERS =====
  ipcMain.handle(IpcChannel.GET_QUOTATION_ITEMS, (_, { quotationId }: { quotationId: number }) => quotationItemController.getByQuotation(quotationId));
  ipcMain.handle(IpcChannel.CREATE_QUOTATION_ITEM, (_, data: any) => quotationItemController.create(data));
  ipcMain.handle(IpcChannel.CREATE_QUOTATION_ITEMS_BULK, (_, { items }: { items: any[] }) => quotationItemController.bulkCreate(items));
  ipcMain.handle(IpcChannel.UPDATE_QUOTATION_ITEM, (_, { id, data }: any) => quotationItemController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_QUOTATION_ITEM, (_, { id }: { id: number }) => quotationItemController.delete(id));

  // ===== CREDIT NOTE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES, () => creditNoteController.getAll());
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTE, (_, { id }: { id: number }) => creditNoteController.getById(id));
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES_BY_CLIENT, (_, { clientId }: { clientId: number }) => creditNoteController.getByClient(clientId));
  ipcMain.handle(IpcChannel.GET_UNALLOCATED_CREDIT_NOTES, () => creditNoteController.getUnallocated());
  ipcMain.handle(IpcChannel.CREATE_CREDIT_NOTE, (_, data: any) => creditNoteController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CREDIT_NOTE, (_, { id, data }: any) => creditNoteController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CREDIT_NOTE, (_, { id }: { id: number }) => creditNoteController.delete(id));

  // ===== CREDIT NOTE ALLOCATION HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTE_ALLOCATIONS, (_, { creditNoteId }: { creditNoteId: number }) => creditNoteAllocationController.getByCreditNote(creditNoteId));
  ipcMain.handle(IpcChannel.CREATE_CREDIT_NOTE_ALLOCATION, (_, data: any) => creditNoteAllocationController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CREDIT_NOTE_ALLOCATION, (_, { id, data }: any) => creditNoteAllocationController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CREDIT_NOTE_ALLOCATION, (_, { id }: { id: number }) => creditNoteAllocationController.delete(id));
}
