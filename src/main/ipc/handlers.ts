import { ipcMain } from 'electron';
import { getDatabaseOrNull, initDatabase, closeDatabase, getConnectionError, runMigrationsAndSeeds } from '../database';
import { IpcChannel } from '../../shared/types/ipc';

// Track which handlers have been registered to avoid duplicates
let configHandlersRegistered = false;
let dataHandlersRegistered = false;

// Import services
import {
  BranchService,
  CategoryService,
  ClientService,
  SupplierService,
  EmployeeService,
  InventoryService,
  VariantService,
  InventoryTransactionService,
  InventoryAlternateService,
  InventoryReceivingService,
  InvoiceService,
  QuotationService,
  CreditNoteService,
  DocumentLineItemService,
  BillService,
  PaymentService,
  PaymentMethodService,
  GctPaymentService,
  EmployeeAttendanceService,
  CreditCheckService,
  SpotlightService,
  SystemSettingsService,
} from '../services';
import { PaymentTransactionService, ProcessInvoicePaymentParams, VoidPaymentParams } from '../services/PaymentTransactionService';
import { ImageStorageService } from '../services/ImageStorageService';
import { InventoryImageService, UploadImageParams } from '../services/InventoryImageService';

// Import controllers
import {
  BranchController,
  CategoryController,
  ClientController,
  SupplierController,
  EmployeeController,
  InventoryController,
  VariantController,
  InventoryTransactionController,
  InventoryAlternateController,
  InventoryReceivingController,
  InvoiceController,
  QuotationController,
  CreditNoteController,
  DocumentLineItemController,
  BillController,
  PaymentController,
  PaymentMethodController,
  GctPaymentController,
  EmployeeAttendanceController,
  SystemSettingsController,
} from '../controllers';

import { DatabaseSettingsService } from '../services/DatabaseSettingsService';
import { DatabaseSettingsController } from '../controllers/DatabaseSettingsController';

// Helper to safely remove a handler if it exists
function removeHandler(channel: IpcChannel) {
  try {
    ipcMain.removeHandler(channel);
  } catch {
    // Handler didn't exist, ignore
  }
}

// Remove all data handlers (called before re-registering)
function removeDataHandlers() {
  // Remove all IpcChannel handlers
  Object.values(IpcChannel).forEach((channel) => {
    if (!channel.startsWith('db:get-config') &&
      !channel.startsWith('db:update-config') &&
      !channel.startsWith('db:test-connection') &&
      !channel.startsWith('db:reconnect') &&
      !channel.startsWith('db:check-status') &&
      !channel.startsWith('db:run-migrations-and-seeds')) {
      removeHandler(channel as IpcChannel);
    }
  });

  dataHandlersRegistered = false;
}

export function registerIpcHandlers() {
  // Database configuration handlers (only register once)
  if (!configHandlersRegistered) {
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
          // Remove old data handlers and re-register with new db instance
          removeDataHandlers();
          registerDataHandlers();
          return { success: true };
        }
        const error = getConnectionError();
        return { success: false, error: error?.message || 'Connection failed' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    ipcMain.handle(IpcChannel.CHECK_DATABASE_STATUS, () => {
      const db = getDatabaseOrNull();
      const error = getConnectionError();
      return {
        connected: db !== null,
        error: error?.message || null,
      };
    });

    ipcMain.handle(IpcChannel.RUN_MIGRATIONS_AND_SEEDS, async () => {
      try {
        const result = await runMigrationsAndSeeds();
        return { success: result.success, data: result };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    configHandlersRegistered = true;
  }

  // Register data handlers if database is available
  registerDataHandlers();
}

function registerDataHandlers() {
  // Get database instance (may be null)
  const db = getDatabaseOrNull();

  // Only register data handlers if database is available and not already registered
  if (!db) {
    console.warn('Database not available, data handlers not registered');
    return;
  }

  if (dataHandlersRegistered) {
    console.log('Data handlers already registered');
    return;
  }

  // Initialize services
  const branchService = new BranchService(db);
  const categoryService = new CategoryService(db);
  const clientService = new ClientService(db);
  const supplierService = new SupplierService(db);
  const employeeService = new EmployeeService(db);
  const inventoryService = new InventoryService(db);
  const variantService = new VariantService(db);
  const inventoryTransactionService = new InventoryTransactionService(db);
  const inventoryAlternateService = new InventoryAlternateService(db);
  const inventoryReceivingService = new InventoryReceivingService(db);
  const quotationService = new QuotationService(db);
  const creditNoteService = new CreditNoteService(db);
  const documentLineItemService = new DocumentLineItemService(db);
  const billService = new BillService(db);
  const paymentService = new PaymentService(db);
  // Initialize InvoiceService with dependencies for atomic transactions
  const invoiceService = new InvoiceService(db, paymentService, creditNoteService, documentLineItemService);
  const paymentMethodService = new PaymentMethodService(db);
  const gctPaymentService = new GctPaymentService(db);
  const employeeAttendanceService = new EmployeeAttendanceService(db);
  const creditCheckService = new CreditCheckService(db);
  const spotlightService = new SpotlightService(db);
  const systemSettingsService = new SystemSettingsService(db);
  const paymentTransactionService = new PaymentTransactionService(db, paymentService, invoiceService, creditNoteService);
  const imageStorageService = new ImageStorageService();
  // Initialize system settings defaults and then storage from settings
  systemSettingsService.initializeDefaults()
    .then(() => imageStorageService.initializeFromSettings(systemSettingsService))
    .catch(err => {
      console.error('Failed to initialize image storage from settings:', err);
    });
  const inventoryImageService = new InventoryImageService(db, imageStorageService);

  // Initialize controllers
  const branchController = new BranchController(branchService);
  const categoryController = new CategoryController(categoryService);
  const clientController = new ClientController(clientService);
  const supplierController = new SupplierController(supplierService);
  const employeeController = new EmployeeController(employeeService);
  const inventoryController = new InventoryController(inventoryService);
  const variantController = new VariantController(variantService);
  const inventoryTransactionController = new InventoryTransactionController(inventoryTransactionService);
  const inventoryAlternateController = new InventoryAlternateController(inventoryAlternateService);
  const inventoryReceivingController = new InventoryReceivingController(inventoryReceivingService);
  const invoiceController = new InvoiceController(invoiceService);
  const quotationController = new QuotationController(quotationService);
  const creditNoteController = new CreditNoteController(creditNoteService);
  const documentLineItemController = new DocumentLineItemController(documentLineItemService);
  const billController = new BillController(billService);
  const paymentController = new PaymentController(paymentService);
  const paymentMethodController = new PaymentMethodController(paymentMethodService);
  const gctPaymentController = new GctPaymentController(gctPaymentService);
  const employeeAttendanceController = new EmployeeAttendanceController(employeeAttendanceService);
  const systemSettingsController = new SystemSettingsController(systemSettingsService);

  // ===== BRANCH HANDLERS =====
  ipcMain.handle(IpcChannel.GET_BRANCHES, () => branchController.getAll());
  ipcMain.handle(IpcChannel.GET_BRANCH, (_, { id }: { id: number }) => branchController.getById(id));
  ipcMain.handle(IpcChannel.GET_BRANCH_BY_CODE, (_, { code }: { code: string }) => branchController.getByCode(code));
  ipcMain.handle(IpcChannel.GET_ACTIVE_BRANCHES, () => branchController.getActive());
  ipcMain.handle(IpcChannel.CREATE_BRANCH, (_, data: any) => branchController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_BRANCH, (_, { id, data }: any) => branchController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_BRANCH, (_, { id }: { id: number }) => branchController.delete(id));

  // ===== CATEGORY HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CATEGORIES, () => categoryController.getAll());
  ipcMain.handle(IpcChannel.GET_CATEGORIES_PAGINATED, (_, params: any = {}) => categoryController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_CATEGORY, (_, { id }: { id: number }) => categoryController.getById(id));
  ipcMain.handle(IpcChannel.GET_CATEGORY_BY_CODE, (_, { code }: { code: string }) => categoryController.getByCode(code));
  ipcMain.handle(IpcChannel.GET_CATEGORIES_BY_TYPE, (_, { categoryType }: { categoryType: 'ACCOUNT' | 'INVENTORY' }) => categoryController.getByType(categoryType));
  ipcMain.handle(IpcChannel.GET_ROOT_CATEGORIES, (_, { categoryType }: { categoryType?: 'ACCOUNT' | 'INVENTORY' } = {}) => categoryController.getRoots(categoryType));
  ipcMain.handle(IpcChannel.CREATE_CATEGORY, (_, data: any) => categoryController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CATEGORY, (_, { id, data }: any) => categoryController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CATEGORY, (_, { id }: { id: number }) => categoryController.delete(id));

  // ===== CLIENT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CLIENTS, () => clientController.getAll());
  ipcMain.handle(IpcChannel.GET_CLIENTS_PAGINATED, (_, params: any = {}) => clientController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_CLIENT, (_, { id }: { id: number }) => clientController.getById(id));
  ipcMain.handle(IpcChannel.GET_CLIENT_BY_EMAIL, (_, { email }: { email: string }) => clientController.getByEmail(email));
  ipcMain.handle(IpcChannel.SEARCH_CLIENTS, (_, { query }: { query: string }) => clientController.search(query));
  ipcMain.handle(IpcChannel.SEARCH_CLIENTS_FOR_SELECT, (_, { query, limit }: { query: string; limit?: number }) => clientController.searchForSelect(query, limit));
  ipcMain.handle(IpcChannel.CREATE_CLIENT, (_, data: any) => clientController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CLIENT, (_, { id, data }: any) => clientController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CLIENT, (_, { id }: { id: number }) => clientController.delete(id));

  // ===== SUPPLIER HANDLERS =====
  ipcMain.handle(IpcChannel.GET_SUPPLIERS, () => supplierController.getAll());
  ipcMain.handle(IpcChannel.GET_SUPPLIERS_PAGINATED, (_, params: any = {}) => supplierController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_SUPPLIER, (_, { id }: { id: number }) => supplierController.getById(id));
  ipcMain.handle(IpcChannel.GET_SUPPLIER_BY_CODE, (_, { supplierCode }: { supplierCode: string }) => supplierController.getBySupplierCode(supplierCode));
  ipcMain.handle(IpcChannel.GET_ACTIVE_SUPPLIERS, () => supplierController.getActive());
  ipcMain.handle(IpcChannel.SEARCH_SUPPLIERS, (_, { query }: { query: string }) => supplierController.search(query));
  ipcMain.handle(IpcChannel.SEARCH_SUPPLIERS_FOR_SELECT, async (_, { query, limit }: { query: string; limit?: number }) => {
    try {
      const data = await supplierService.searchForSelect(query, limit);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  ipcMain.handle(IpcChannel.CREATE_SUPPLIER, (_, data: any) => supplierController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_SUPPLIER, (_, { id, data }: any) => supplierController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_SUPPLIER, (_, { id }: { id: number }) => supplierController.delete(id));
  ipcMain.handle(IpcChannel.ACTIVATE_SUPPLIER, (_, { id }: { id: number }) => supplierController.activate(id));
  ipcMain.handle(IpcChannel.DEACTIVATE_SUPPLIER, (_, { id }: { id: number }) => supplierController.deactivate(id));

  // ===== EMPLOYEE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_EMPLOYEES, () => employeeController.getAll());
  ipcMain.handle(IpcChannel.GET_EMPLOYEES_PAGINATED, (_, params: any = {}) => employeeController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE, (_, { id }: { id: number }) => employeeController.getById(id));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_BY_USERNAME, (_, { username }: { username: string }) => employeeController.getByUsername(username));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_BY_CODE, (_, { employeeCode }: { employeeCode: string }) => employeeController.getByEmployeeCode(employeeCode));
  ipcMain.handle(IpcChannel.GET_ACTIVE_EMPLOYEES, () => employeeController.getActive());
  ipcMain.handle(IpcChannel.GET_SALESPEOPLE, () => employeeController.getSalespeople());
  ipcMain.handle(IpcChannel.SEARCH_EMPLOYEES, (_, { query }: { query: string }) => employeeController.search(query));
  ipcMain.handle(IpcChannel.SEARCH_EMPLOYEES_FOR_SELECT, (_, { query, limit, activeOnly }: { query: string; limit?: number; activeOnly?: boolean }) => employeeController.searchForSelect(query, limit, activeOnly));
  ipcMain.handle(IpcChannel.CREATE_EMPLOYEE, (_, data: any) => employeeController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_EMPLOYEE, (_, { id, data }: any) => employeeController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_EMPLOYEE, (_, { id }: { id: number }) => employeeController.delete(id));
  ipcMain.handle(IpcChannel.GENERATE_EMPLOYEE_CODE, () => employeeController.generateNextCode());
  ipcMain.handle(IpcChannel.AUTHENTICATE_EMPLOYEE, (_, { username, password }: { username: string; password: string }) => employeeController.authenticate(username, password));
  ipcMain.handle(IpcChannel.VERIFY_EMPLOYEE_PIN, (_, { pin }: { pin: string }) => employeeController.verifyPin(pin));
  ipcMain.handle(IpcChannel.UPDATE_EMPLOYEE_PASSWORD, (_, { id, newPassword }: { id: number; newPassword: string }) => employeeController.updatePassword(id, newPassword));
  ipcMain.handle(IpcChannel.UPDATE_EMPLOYEE_PERMISSIONS, (_, { id, permissions }: { id: number; permissions: Record<string, any> }) => employeeController.updatePermissions(id, permissions));

  // ===== EMPLOYEE ACTIVITY HANDLERS =====
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_INVOICES, (_, { employeeId, ...params }: { employeeId: number; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => employeeController.getEmployeeInvoices(employeeId, params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_QUOTATIONS, (_, { employeeId, ...params }: { employeeId: number; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => employeeController.getEmployeeQuotations(employeeId, params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_CREDIT_NOTES, (_, { employeeId, ...params }: { employeeId: number; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => employeeController.getEmployeeCreditNotes(employeeId, params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_PAYMENTS, (_, { employeeId, ...params }: { employeeId: number; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => employeeController.getEmployeePayments(employeeId, params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_ATTENDANCE, (_, { employeeId, ...params }: { employeeId: number; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => employeeController.getEmployeeAttendance(employeeId, params));
  ipcMain.handle(IpcChannel.GET_EMPLOYEE_ACTIVITY_SUMMARY, (_, { employeeId, ...params }: { employeeId: number; startDate?: string; endDate?: string }) => employeeController.getEmployeeActivitySummary(employeeId, params));

  // ===== INVENTORY HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVENTORY, () => inventoryController.getAll());
  ipcMain.handle(IpcChannel.GET_INVENTORY_PAGINATED, (_, params: any = {}) => inventoryController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_INVENTORY_ITEM, (_, { id }: { id: number }) => inventoryController.getById(id));
  ipcMain.handle(IpcChannel.GET_INVENTORY_BY_SKU, (_, { sku }: { sku: string }) => inventoryController.getBySku(sku));
  ipcMain.handle(IpcChannel.GET_LOW_STOCK_INVENTORY, () => inventoryController.getLowStock());
  ipcMain.handle(IpcChannel.GET_ACTIVE_INVENTORY, () => inventoryController.getActive());
  ipcMain.handle(IpcChannel.SEARCH_INVENTORY, (_, { query }: { query: string }) => inventoryController.search(query));
  ipcMain.handle(IpcChannel.SEARCH_INVENTORY_FOR_SELECT, (_, { query, limit }: { query: string; limit?: number }) => inventoryController.searchForSelect(query, limit));
  ipcMain.handle(IpcChannel.SEARCH_INVENTORY_WITH_VARIANTS, (_, { query, limit }: { query: string; limit?: number }) => inventoryController.searchWithVariants(query, limit));
  ipcMain.handle(IpcChannel.GET_DISTINCT_CATEGORIES, (_, { search, limit }: { search?: string; limit?: number } = {}) =>
    inventoryController.getDistinctCategories(search, limit));
  ipcMain.handle(IpcChannel.GET_DISTINCT_MODELS, (_, { search, limit }: { search?: string; limit?: number } = {}) =>
    inventoryController.getDistinctModels(search, limit));
  ipcMain.handle(IpcChannel.CREATE_INVENTORY, (_, data: any) => inventoryController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_INVENTORY, (_, { id, data }: any) => inventoryController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_INVENTORY, (_, { id }: { id: number }) => inventoryController.delete(id));
  ipcMain.handle(IpcChannel.UPDATE_INVENTORY_STOCK, (_, { id, quantity }: { id: number; quantity: number }) => inventoryController.updateStock(id, quantity));
  ipcMain.handle(IpcChannel.GET_INVENTORY_VARIANTS, (_, { parentSku }: { parentSku: string }) => inventoryController.getVariants(parentSku));
  ipcMain.handle(IpcChannel.CHECK_HAS_VARIANTS, (_, { parentSku }: { parentSku: string }) => inventoryController.checkHasVariants(parentSku));

  // ===== VARIANT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_VARIANTS, () => variantController.getAll());
  ipcMain.handle(IpcChannel.GET_VARIANTS_PAGINATED, (_, params: any = {}) => variantController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_VARIANT, (_, { id }: { id: number }) => variantController.getById(id));
  ipcMain.handle(IpcChannel.GET_VARIANTS_BY_INVENTORY, (_, { inventoryId }: { inventoryId: number }) => variantController.getByInventoryId(inventoryId));
  ipcMain.handle(IpcChannel.GET_VARIANT_BY_BARCODE, (_, { barcode }: { barcode: string }) => variantController.getByBarcode(barcode));
  ipcMain.handle(IpcChannel.GET_VARIANT_BY_SKU, (_, { variantSku }: { variantSku: string }) => variantController.getByVariantSku(variantSku));
  ipcMain.handle(IpcChannel.GET_ACTIVE_VARIANTS, (_, { inventoryId }: { inventoryId?: number } = {}) => variantController.getActive(inventoryId));
  ipcMain.handle(IpcChannel.GET_LOW_STOCK_VARIANTS, () => variantController.getLowStock());
  ipcMain.handle(IpcChannel.SEARCH_VARIANTS_FOR_SELECT, (_, { query, limit }: { query: string; limit?: number }) => variantController.searchForSelect(query, limit));
  ipcMain.handle(IpcChannel.CREATE_VARIANT, (_, data: any) => variantController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_VARIANT, (_, { id, data }: any) => variantController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_VARIANT, (_, { id }: { id: number }) => variantController.delete(id));
  ipcMain.handle(IpcChannel.UPDATE_VARIANT_STOCK, (_, { id, quantity }: { id: number; quantity: number }) => variantController.updateStock(id, quantity));
  ipcMain.handle(IpcChannel.SET_VARIANT_STOCK, (_, { id, stockQty }: { id: number; stockQty: number }) => variantController.setStock(id, stockQty));

  // ===== INVENTORY TRANSACTION HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVENTORY_TRANSACTIONS, () => inventoryTransactionController.getAll());
  ipcMain.handle(IpcChannel.GET_INVENTORY_TRANSACTIONS_PAGINATED, (_, params: any = {}) => inventoryTransactionController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_INVENTORY_TRANSACTIONS_BY_SKU, (_, { sku, ...params }: { sku: string; page?: number; pageSize?: number }) => inventoryTransactionController.getBySkuPaginated(sku, params));
  ipcMain.handle(IpcChannel.GET_INVENTORY_TRANSACTIONS_BY_DATE_RANGE, (_, { startDate, endDate, ...params }: { startDate: string; endDate: string; page?: number; pageSize?: number }) => inventoryTransactionController.getByDateRangePaginated(startDate, endDate, params));
  ipcMain.handle(IpcChannel.CREATE_INVENTORY_TRANSACTION, (_, data: any) => inventoryTransactionController.create(data));

  // ===== INVENTORY ALTERNATES HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVENTORY_ALTERNATES, () => inventoryAlternateController.getAll());
  ipcMain.handle(IpcChannel.GET_INVENTORY_ALTERNATES_BY_PART, (_, { partNo }: { partNo: string }) => inventoryAlternateController.getByPartNo(partNo));
  ipcMain.handle(IpcChannel.CREATE_INVENTORY_ALTERNATE, (_, { partNo, alternateNo, supplier }: { partNo: string; alternateNo: string; supplier?: string }) => inventoryAlternateController.createAlternate(partNo, alternateNo, supplier));
  ipcMain.handle(IpcChannel.DELETE_INVENTORY_ALTERNATE, (_, { partNo, alternateNo }: { partNo: string; alternateNo: string }) => inventoryAlternateController.deleteAlternate(partNo, alternateNo));

  // ===== INVENTORY RECEIVING HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVENTORY_RECEIVING, () => inventoryReceivingController.getAll());
  ipcMain.handle(IpcChannel.GET_INVENTORY_RECEIVING_BY_ID, (_, { id }: { id: number }) => inventoryReceivingController.getById(id));
  ipcMain.handle(IpcChannel.GET_INVENTORY_RECEIVING_BY_SKU, (_, { sku }: { sku: string }) => inventoryReceivingController.getBySku(sku));
  ipcMain.handle(IpcChannel.GET_INVENTORY_RECEIVING_BY_SKU_PAGINATED, (_, { sku, ...params }: { sku: string; page?: number; pageSize?: number }) => inventoryReceivingController.getBySkuPaginated(sku, params));
  ipcMain.handle(IpcChannel.GET_INVENTORY_RECEIVING_BY_SUPPLIER, (_, { supplierId, ...params }: { supplierId: number; page?: number; pageSize?: number }) => inventoryReceivingController.getBySupplierIdPaginated(supplierId, params));
  ipcMain.handle(IpcChannel.CREATE_INVENTORY_RECEIVING, (_, data: any) => inventoryReceivingController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_INVENTORY_RECEIVING, (_, { id, data }: any) => inventoryReceivingController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_INVENTORY_RECEIVING, (_, { id }: { id: number }) => inventoryReceivingController.delete(id));

  // ===== INVENTORY SALES HANDLERS =====
  ipcMain.handle(IpcChannel.GET_VARIANT_SALES, (_, { sku, ...params }: { sku: string; page?: number; pageSize?: number; startDate?: string; endDate?: string }) => documentLineItemController.getVariantSales(sku, params));
  ipcMain.handle(IpcChannel.GET_INVENTORY_SALES_SUMMARY, (_, { sku, startDate, endDate }: { sku: string; startDate?: string; endDate?: string }) => documentLineItemController.getInventorySalesSummary(sku, { startDate, endDate }));

  // ===== INVOICE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_INVOICES, (_, { includeArchived }: { includeArchived?: boolean } = {}) => invoiceController.getAll(includeArchived ?? false));
  ipcMain.handle(IpcChannel.GET_INVOICES_PAGINATED, (_, params: any = {}) => invoiceController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_INVOICE, (_, { id }: { id: number }) => invoiceController.getById(id));
  ipcMain.handle(IpcChannel.GET_INVOICE_BY_NUMBER, (_, { invNumber }: { invNumber: string }) => invoiceController.getByInvNumber(invNumber));
  ipcMain.handle(IpcChannel.GET_INVOICES_BY_CLIENT, (_, { clientId }: { clientId: number }) => invoiceController.getByClient(clientId));
  ipcMain.handle(IpcChannel.GET_INVOICES_BY_SALESPERSON, (_, { salespersonId }: { salespersonId: number }) => invoiceController.getBySalesperson(salespersonId));
  ipcMain.handle(IpcChannel.GET_UNPAID_INVOICES, () => invoiceController.getUnpaid());
  ipcMain.handle(IpcChannel.GET_ADJACENT_INVOICES, (_, { id }: { id: number }) => invoiceController.getAdjacentInvoices(id));
  ipcMain.handle(IpcChannel.GET_ADJACENT_INVOICES_WITH_DATA, (_, { id }: { id: number }) => invoiceController.getAdjacentInvoicesWithData(id));
  ipcMain.handle(IpcChannel.CREATE_INVOICE, (_, data: any) => invoiceController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_INVOICE, (_, { id, data }: any) => invoiceController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_INVOICE, (_, { id }: { id: number }) => invoiceController.delete(id));
  ipcMain.handle(IpcChannel.RECORD_INVOICE_PAYMENT, (_, { id, amount }: { id: number; amount: string }) => invoiceController.recordPayment(id, amount));
  ipcMain.handle(IpcChannel.ARCHIVE_INVOICE, (_, { id }: { id: number }) => invoiceController.archive(id));

  // ===== INVOICE STATUS HANDLERS =====
  ipcMain.handle(
    IpcChannel.GET_RECENT_INVOICES,
    async (_, { limit, sortField, sortDirection }: { limit?: number; sortField?: string; sortDirection?: 'asc' | 'desc' } = {}) => {
      try {
        const data = await invoiceService.findRecentInvoices(limit, sortField, sortDirection);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  );
  ipcMain.handle(IpcChannel.GET_OVERDUE_INVOICES, async (_, { creditTermsDays }: { creditTermsDays?: number } = {}) => {
    try {
      const data = await invoiceService.findOverdueInvoices(creditTermsDays);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  ipcMain.handle(
    IpcChannel.SEARCH_INVOICES,
    async (_, { query, limit, sortField, sortDirection }: { query: string; limit?: number; sortField?: string; sortDirection?: 'asc' | 'desc' }) => {
      try {
        const data = await invoiceService.searchInvoices(query, limit, sortField, sortDirection);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
  );

  ipcMain.handle(
    IpcChannel.CHECK_INVOICE_INVENTORY,
    async (_, { lineItems }: { lineItems: Array<{ sku: string | null; quantity: number }> }) =>
      invoiceController.checkInventoryAvailability(lineItems)
  );

  ipcMain.handle(
    IpcChannel.CREATE_INVOICE_TRANSACTIONS,
    async (
      _,
      {
        invNumber,
        lineItems,
        invDate,
      }: { invNumber: string; lineItems: Array<{ sku: string | null; quantity: number }>; invDate: string }
    ) => invoiceController.createInventoryTransactions(invNumber, lineItems, invDate)
  );

  // Create invoice with payment (atomic transaction)
  ipcMain.handle(IpcChannel.CREATE_INVOICE_WITH_PAYMENT, async (_, params) => {
    try {
      const result = await invoiceService.createInvoiceWithPayment(params);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create invoice with payment',
      };
    }
  });

  // ===== SPOTLIGHT SEARCH HANDLERS =====
  ipcMain.handle(IpcChannel.SPOTLIGHT_SEARCH, async (_, params: { query: string; limit?: number; types?: ('invoice' | 'client' | 'inventory' | 'quotation')[] }) => {
    try {
      const data = await spotlightService.search(params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ===== ACCESS CODE VERIFICATION HANDLERS =====
  ipcMain.handle(IpcChannel.VERIFY_ACCESS_CODE, async (_, { accessCode }: { accessCode: string }) => {
    try {
      // Find employee by code column
      const employee = await employeeService.findByCode(accessCode);

      if (!employee) {
        return { success: false, error: 'Invalid access code' };
      }

      return {
        success: true,
        data: {
          employeeId: employee.id,
          employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.code,
          isSalesperson: employee.isSalesperson,
          permissions: employee.permissions,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(IpcChannel.CHECK_SALESPERSON_ACCESS, async (_, { accessCode }: { accessCode: string }) => {
    try {
      // Find employee by code column
      const employee = await employeeService.findByCode(accessCode);

      if (!employee) {
        return { success: false, error: 'Invalid access code' };
      }

      if (!employee.isSalesperson) {
        return { success: false, error: 'Access code does not belong to a salesperson' };
      }

      // Check for CREATE_INVOICE permission
      const permissions = employee.permissions as Record<string, boolean> | null;
      const canCreateInvoice = permissions?.CREATE_INVOICE ?? false;

      if (!canCreateInvoice) {
        return { success: false, error: 'Employee does not have permission to create invoices' };
      }

      return {
        success: true,
        data: {
          employeeId: employee.id,
          employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.code,
          isSalesperson: true,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ===== CREDIT CHECK HANDLERS =====
  ipcMain.handle(IpcChannel.CHECK_CLIENT_CREDIT, async (_, { clientId }: { clientId: number }) => {
    try {
      const data = await creditCheckService.checkClientCredit(clientId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle(IpcChannel.GET_CLIENT_ARREARS_INFO, async (_, { clientId }: { clientId: number }) => {
    try {
      const data = await creditCheckService.getClientArrearsInfo(clientId);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ===== QUOTATION HANDLERS =====
  ipcMain.handle(IpcChannel.GET_QUOTATIONS, () => quotationController.getAll());
  ipcMain.handle(IpcChannel.GET_QUOTATIONS_PAGINATED, (_, params: any = {}) => quotationController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_QUOTATION, (_, { id }: { id: number }) => quotationController.getById(id));
  ipcMain.handle(IpcChannel.GET_QUOTATION_BY_NUMBER, (_, { quoteNum }: { quoteNum: string }) => quotationController.getByQuoteNum(quoteNum));
  ipcMain.handle(IpcChannel.GET_QUOTATIONS_BY_CLIENT, (_, { clientId }: { clientId: number }) => quotationController.getByClient(clientId));
  ipcMain.handle(IpcChannel.GET_QUOTATIONS_BY_SALESPERSON, (_, { salespersonId }: { salespersonId: number }) => quotationController.getBySalesperson(salespersonId));
  ipcMain.handle(IpcChannel.CREATE_QUOTATION, (_, data: any) => quotationController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_QUOTATION, (_, { id, data }: any) => quotationController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_QUOTATION, (_, { id }: { id: number }) => quotationController.delete(id));
  ipcMain.handle(IpcChannel.CONVERT_QUOTATION_TO_INVOICE, (_, { id }: { id: number }) => quotationController.convertToInvoice(id));
  ipcMain.handle(IpcChannel.EXPIRE_QUOTATION, (_, { id }: { id: number }) => quotationController.expire(id));
  ipcMain.handle(IpcChannel.ARCHIVE_QUOTATION, (_, { id }: { id: number }) => quotationController.archive(id));
  ipcMain.handle(IpcChannel.GET_ADJACENT_QUOTATIONS, (_, { id }: { id: number }) => quotationController.getAdjacentQuotations(id));

  // ===== CREDIT NOTE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES, () => creditNoteController.getAll());
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES_PAGINATED, (_, params: any = {}) => creditNoteController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTE, (_, { id }: { id: number }) => creditNoteController.getById(id));
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTE_BY_NUMBER, (_, { crNumber }: { crNumber: string }) => creditNoteController.getByCrNumber(crNumber));
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES_BY_CLIENT, (_, { clientId }: { clientId: number }) => creditNoteController.getByClient(clientId));
  ipcMain.handle(IpcChannel.GET_CREDIT_NOTES_BY_INVOICE, (_, { invNumber }: { invNumber: string }) => creditNoteController.getByInvoice(invNumber));
  ipcMain.handle(IpcChannel.GET_UNUSED_CREDIT_NOTES, () => creditNoteController.getUnused());
  ipcMain.handle(IpcChannel.CREATE_CREDIT_NOTE, (_, data: any) => creditNoteController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_CREDIT_NOTE, (_, { id, data }: any) => creditNoteController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_CREDIT_NOTE, (_, { id }: { id: number }) => creditNoteController.delete(id));
  ipcMain.handle(IpcChannel.RECORD_CREDIT_NOTE_USAGE, (_, { id, amount }: { id: number; amount: string }) => creditNoteController.recordUsage(id, amount));
  ipcMain.handle(IpcChannel.ARCHIVE_CREDIT_NOTE, (_, { id }: { id: number }) => creditNoteController.archive(id));

  // ===== DOCUMENT LINE ITEM HANDLERS =====
  ipcMain.handle(IpcChannel.GET_DOCUMENT_LINE_ITEMS, () => documentLineItemController.getAll());
  ipcMain.handle(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_INVOICE, (_, { invNumber }: { invNumber: string }) => documentLineItemController.getByInvoice(invNumber));
  ipcMain.handle(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_QUOTATION, (_, { quoteNum }: { quoteNum: string }) => documentLineItemController.getByQuotation(quoteNum));
  ipcMain.handle(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_CREDIT_NOTE, (_, { crNumber }: { crNumber: string }) => documentLineItemController.getByCreditNote(crNumber));
  ipcMain.handle(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, (_, data: any) => documentLineItemController.create(data));
  ipcMain.handle(IpcChannel.CREATE_DOCUMENT_LINE_ITEMS_BULK, (_, { items }: { items: any[] }) => documentLineItemController.bulkCreate(items));
  ipcMain.handle(IpcChannel.UPDATE_DOCUMENT_LINE_ITEM, (_, { id, data }: any) => documentLineItemController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_DOCUMENT_LINE_ITEM, (_, { id }: { id: number }) => documentLineItemController.delete(id));
  ipcMain.handle(IpcChannel.DELETE_DOCUMENT_LINE_ITEMS_BY_DOCUMENT, (_, { documentType, documentNumber }: { documentType: 'INVOICE' | 'QUOTE' | 'CREDIT'; documentNumber: string }) => documentLineItemController.deleteByDocument(documentType, documentNumber));

  // ===== BILL HANDLERS =====
  ipcMain.handle(IpcChannel.GET_BILLS, () => billController.getAll());
  ipcMain.handle(IpcChannel.GET_BILLS_PAGINATED, (_, params: any = {}) => billController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_BILL, (_, { id }: { id: number }) => billController.getById(id));
  ipcMain.handle(IpcChannel.GET_BILL_BY_NUMBER, (_, { billNo }: { billNo: string }) => billController.getByBillNo(billNo));
  ipcMain.handle(IpcChannel.GET_BILLS_BY_SUPPLIER, (_, { supplierId }: { supplierId: number }) => billController.getBySupplier(supplierId));
  ipcMain.handle(IpcChannel.GET_UNPAID_BILLS, () => billController.getUnpaid());
  ipcMain.handle(IpcChannel.CREATE_BILL, (_, data: any) => billController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_BILL, (_, { id, data }: any) => billController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_BILL, (_, { id }: { id: number }) => billController.delete(id));
  ipcMain.handle(IpcChannel.RECORD_BILL_PAYMENT, (_, { id, amount }: { id: number; amount: string }) => billController.recordPayment(id, amount));
  ipcMain.handle(IpcChannel.ARCHIVE_BILL, (_, { id }: { id: number }) => billController.archive(id));

  // ===== PAYMENT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PAYMENTS, () => paymentController.getAll());
  ipcMain.handle(IpcChannel.GET_PAYMENTS_PAGINATED, (_, params: any = {}) => paymentController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_PAYMENT, (_, { id }: { id: number }) => paymentController.getById(id));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_DOCUMENT_TYPE, (_, { documentType }: { documentType: 'INVOICE' | 'CREDIT' | 'BILL' }) => paymentController.getByDocumentType(documentType));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_INVOICE, (_, { invoiceNumber }: { invoiceNumber: string }) => paymentController.getByInvoice(invoiceNumber));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_CREDIT_NOTE, (_, { creditNoteNumber }: { creditNoteNumber: string }) => paymentController.getByCreditNote(creditNoteNumber));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_BILL, (_, { billNumber }: { billNumber: string }) => paymentController.getByBill(billNumber));
  ipcMain.handle(IpcChannel.GET_PAYMENTS_BY_DATE_RANGE, (_, { startDate, endDate }: { startDate: string; endDate: string }) => paymentController.getByDateRange(startDate, endDate));
  ipcMain.handle(IpcChannel.CREATE_PAYMENT, (_, data: any) => paymentController.create(data));
  ipcMain.handle(IpcChannel.CREATE_INVOICE_PAYMENT, (_, { invoiceNumber, amount, payerName, paymentDesc }: any) => paymentController.createInvoicePayment(invoiceNumber, amount, payerName, paymentDesc));
  ipcMain.handle(IpcChannel.CREATE_BILL_PAYMENT, (_, { billNumber, amount, payerName, paymentDesc }: any) => paymentController.createBillPayment(billNumber, amount, payerName, paymentDesc));
  ipcMain.handle(IpcChannel.UPDATE_PAYMENT, (_, { id, data }: any) => paymentController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PAYMENT, (_, { id }: { id: number }) => paymentController.delete(id));

  // Payment transaction handlers (split payments, voiding)
  ipcMain.handle(IpcChannel.PROCESS_INVOICE_PAYMENT, async (_, params: ProcessInvoicePaymentParams) => {
    try {
      const result = await paymentTransactionService.processInvoicePayment(params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Payment processing failed' };
    }
  });

  ipcMain.handle(IpcChannel.VOID_PAYMENT, async (_, params: VoidPaymentParams) => {
    try {
      const result = await paymentTransactionService.voidPayment(params);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Payment voiding failed' };
    }
  });

  ipcMain.handle(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, async (_, { clientId }: { clientId: number }) => {
    try {
      const creditNotes = await paymentTransactionService.getAvailableCreditNotes(clientId);
      return { success: true, data: creditNotes };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get available credit notes' };
    }
  });

  // ===== PAYMENT METHOD HANDLERS =====
  ipcMain.handle(IpcChannel.GET_PAYMENT_METHODS, () => paymentMethodController.getAll());
  ipcMain.handle(IpcChannel.GET_PAYMENT_METHOD, (_, { id }: { id: number }) => paymentMethodController.getById(id));
  ipcMain.handle(IpcChannel.GET_PAYMENT_METHOD_BY_CODE, (_, { code }: { code: string }) => paymentMethodController.getByCode(code));
  ipcMain.handle(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, () => paymentMethodController.getActive());
  ipcMain.handle(IpcChannel.CREATE_PAYMENT_METHOD, (_, data: any) => paymentMethodController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_PAYMENT_METHOD, (_, { id, data }: any) => paymentMethodController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_PAYMENT_METHOD, (_, { id }: { id: number }) => paymentMethodController.delete(id));

  // ===== GCT PAYMENT HANDLERS =====
  ipcMain.handle(IpcChannel.GET_GCT_PAYMENTS, () => gctPaymentController.getAll());
  ipcMain.handle(IpcChannel.GET_GCT_PAYMENTS_PAGINATED, (_, params: any = {}) => gctPaymentController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_GCT_PAYMENT, (_, { id }: { id: number }) => gctPaymentController.getById(id));
  ipcMain.handle(IpcChannel.GET_GCT_PAYMENTS_BY_PERIOD, (_, { periodStart, periodEnd }: { periodStart: string; periodEnd: string }) => gctPaymentController.getByPeriod(periodStart, periodEnd));
  ipcMain.handle(IpcChannel.GET_GCT_PAYMENTS_BY_YEAR, (_, { year }: { year: number }) => gctPaymentController.getByYear(year));
  ipcMain.handle(IpcChannel.CREATE_GCT_PAYMENT, (_, data: any) => gctPaymentController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_GCT_PAYMENT, (_, { id, data }: any) => gctPaymentController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_GCT_PAYMENT, (_, { id }: { id: number }) => gctPaymentController.delete(id));

  // ===== EMPLOYEE ATTENDANCE HANDLERS =====
  ipcMain.handle(IpcChannel.GET_ATTENDANCE, () => employeeAttendanceController.getAll());
  ipcMain.handle(IpcChannel.GET_ATTENDANCE_PAGINATED, (_, params: any = {}) => employeeAttendanceController.getPaginated(params));
  ipcMain.handle(IpcChannel.GET_ATTENDANCE_RECORD, (_, { id }: { id: number }) => employeeAttendanceController.getById(id));
  ipcMain.handle(IpcChannel.GET_ATTENDANCE_BY_EMPLOYEE, (_, { employeeId }: { employeeId: number }) => employeeAttendanceController.getByEmployee(employeeId));
  ipcMain.handle(IpcChannel.GET_ATTENDANCE_BY_DATE_RANGE, (_, { startDate, endDate, employeeId }: { startDate: string; endDate: string; employeeId?: number }) => employeeAttendanceController.getByDateRange(startDate, endDate, employeeId));
  ipcMain.handle(IpcChannel.GET_ACTIVE_CLOCK_IN, (_, { employeeId }: { employeeId: number }) => employeeAttendanceController.getActiveClockIn(employeeId));
  ipcMain.handle(IpcChannel.CLOCK_IN, (_, { employeeId, notes }: { employeeId: number; notes?: string }) => employeeAttendanceController.clockIn(employeeId, notes));
  ipcMain.handle(IpcChannel.CLOCK_OUT, (_, { employeeId, notes }: { employeeId: number; notes?: string }) => employeeAttendanceController.clockOut(employeeId, notes));
  ipcMain.handle(IpcChannel.GET_TOTAL_HOURS, (_, { employeeId, startDate, endDate }: { employeeId: number; startDate: string; endDate: string }) => employeeAttendanceController.getTotalHours(employeeId, startDate, endDate));
  ipcMain.handle(IpcChannel.CREATE_ATTENDANCE, (_, data: any) => employeeAttendanceController.create(data));
  ipcMain.handle(IpcChannel.UPDATE_ATTENDANCE, (_, { id, data }: any) => employeeAttendanceController.update(id, data));
  ipcMain.handle(IpcChannel.DELETE_ATTENDANCE, (_, { id }: { id: number }) => employeeAttendanceController.delete(id));

  // ===== SYSTEM SETTINGS HANDLERS =====
  ipcMain.handle(IpcChannel.GET_SYSTEM_SETTINGS, () => systemSettingsController.getAll());
  ipcMain.handle(IpcChannel.GET_SYSTEM_SETTINGS_VISIBLE, () => systemSettingsController.getVisible());
  ipcMain.handle(IpcChannel.GET_SYSTEM_SETTINGS_BY_GROUP, (_, { group }: { group: string }) => systemSettingsController.getByGroup(group));
  ipcMain.handle(IpcChannel.GET_SYSTEM_SETTING, (_, { key }: { key: string }) => systemSettingsController.getByKey(key));
  ipcMain.handle(IpcChannel.GET_SYSTEM_SETTING_VALUE, (_, { key }: { key: string }) => systemSettingsController.getValue(key));
  ipcMain.handle(IpcChannel.GET_TAX_RATE, () => systemSettingsController.getTaxRate());
  ipcMain.handle(IpcChannel.SET_SYSTEM_SETTING, (_, { key, value }: { key: string; value: string }) => systemSettingsController.setValue(key, value));
  ipcMain.handle(IpcChannel.UPSERT_SYSTEM_SETTING, (_, { key, value, group, description, readonly, visible }: { key: string; value: string; group: string; description?: string; readonly?: boolean; visible?: boolean }) => systemSettingsController.upsert(key, value, group, description, readonly, visible));
  ipcMain.handle(IpcChannel.DELETE_SYSTEM_SETTING, (_, { key }: { key: string }) => systemSettingsController.deleteByKey(key));
  ipcMain.handle(IpcChannel.INITIALIZE_SYSTEM_SETTINGS, () => systemSettingsController.initializeDefaults());

  // ===== FILE STORAGE HANDLERS =====
  ipcMain.handle(IpcChannel.VALIDATE_STORAGE_PATH, async (_, { path }: { path: string }) => {
    try {
      const result = imageStorageService.validateStoragePath(path);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to validate storage path' };
    }
  });

  ipcMain.handle(IpcChannel.REINITIALIZE_STORAGE, async (_, { type, path }: { type: 'local' | 'lan'; path?: string }) => {
    try {
      imageStorageService.reinitialize(type, path);
      return { success: true, data: imageStorageService.getStorageInfo() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reinitialize storage' };
    }
  });

  ipcMain.handle(IpcChannel.GET_STORAGE_INFO, async () => {
    try {
      const info = imageStorageService.getStorageInfo();
      return { success: true, data: info };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get storage info' };
    }
  });

  // ===== INVENTORY IMAGE HANDLERS =====
  ipcMain.handle(IpcChannel.UPLOAD_INVENTORY_IMAGE, async (_, params: { sku: string; isVariant: boolean; fileData: string; fileName: string; mimeType: string; isPrimary?: boolean }) => {
    console.log(`[IPC] UPLOAD_INVENTORY_IMAGE: SKU=${params.sku}, isVariant=${params.isVariant}, fileName=${params.fileName}`);
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(params.fileData, 'base64');
      console.log(`[IPC] Buffer size: ${buffer.length} bytes`);
      const result = await inventoryImageService.uploadImage({
        sku: params.sku,
        isVariant: params.isVariant,
        buffer,
        originalFileName: params.fileName,
        mimeType: params.mimeType,
        isPrimary: params.isPrimary,
      });
      console.log(`[IPC] UPLOAD_INVENTORY_IMAGE: Success`);
      return { success: true, data: result };
    } catch (error) {
      console.error(`[IPC] UPLOAD_INVENTORY_IMAGE: Error`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Failed to upload image' };
    }
  });

  ipcMain.handle(IpcChannel.DELETE_INVENTORY_IMAGE, async (_, { imageId }: { imageId: number }) => {
    try {
      const result = await inventoryImageService.deleteImage(imageId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete image' };
    }
  });

  ipcMain.handle(IpcChannel.GET_INVENTORY_IMAGES, async (_, { sku, isVariant }: { sku: string; isVariant: boolean }) => {
    try {
      const images = await inventoryImageService.getImagesForSku(sku, isVariant);
      return { success: true, data: images };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get images' };
    }
  });

  ipcMain.handle(IpcChannel.GET_INVENTORY_IMAGES_WITH_DATA, async (_, { sku, isVariant }: { sku: string; isVariant: boolean }) => {
    try {
      const images = await inventoryImageService.getImagesWithBase64(sku, isVariant);
      return { success: true, data: images };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get images with data' };
    }
  });

  ipcMain.handle(IpcChannel.GET_PRIMARY_THUMBNAIL, async (_, { sku, isVariant }: { sku: string; isVariant: boolean }) => {
    try {
      const thumbnail = await inventoryImageService.getPrimaryThumbnail(sku, isVariant);
      return { success: true, data: thumbnail };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get primary thumbnail' };
    }
  });

  ipcMain.handle(IpcChannel.GET_PRIMARY_THUMBNAILS_BATCH, async (_, { items }: { items: Array<{ sku: string; isVariant: boolean }> }) => {
    try {
      const thumbnails = await inventoryImageService.getPrimaryThumbnailsBatch(items);
      // Convert Map to object for IPC serialization
      const result: Record<string, string> = {};
      thumbnails.forEach((value, key) => {
        result[key] = value;
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get thumbnails batch' };
    }
  });

  ipcMain.handle(IpcChannel.SET_PRIMARY_IMAGE, async (_, { imageId }: { imageId: number }) => {
    try {
      const result = await inventoryImageService.setPrimaryImage(imageId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set primary image' };
    }
  });

  ipcMain.handle(IpcChannel.REORDER_IMAGES, async (_, { imageIds }: { imageIds: number[] }) => {
    try {
      await inventoryImageService.reorderImages(imageIds);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reorder images' };
    }
  });

  ipcMain.handle(IpcChannel.GET_IMAGE_FILE, async (_, { relativePath }: { relativePath: string }) => {
    try {
      const base64 = inventoryImageService.getImageBase64(relativePath);
      return { success: true, data: base64 };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get image file' };
    }
  });

  ipcMain.handle(IpcChannel.GET_ALL_PRODUCT_IMAGES, async (_, { mainSku, variantSkus }: { mainSku: string; variantSkus: string[] }) => {
    try {
      const result = await inventoryImageService.getAllProductImages(mainSku, variantSkus);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get all product images' };
    }
  });

  dataHandlersRegistered = true;
  console.log('Data handlers registered successfully');
}
