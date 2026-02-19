export * from './types';
export * from './BaseService';

// Reference/Lookup Services
export { BranchService } from './BranchService';
export { CategoryService, type CategoryQueryParams } from './CategoryService';

// Master Data Services
export { ClientService, type ClientQueryParams } from './ClientService';
export { SupplierService, type SupplierQueryParams } from './SupplierService';
export { EmployeeService, type EmployeeQueryParams, type AuthResult } from './EmployeeService';

// Inventory Services
export { InventoryService, type InventoryQueryParams } from './InventoryService';
export { VariantService, type VariantQueryParams, type VariantWithInventory } from './VariantService';
export { InventoryAlternateService } from './InventoryAlternateService';
export { InventoryTransactionService, type InventoryTransactionQueryParams } from './InventoryTransactionService';
export { InventoryReceivingService } from './InventoryReceivingService';
export { ImageStorageService, type SaveImageResult } from './ImageStorageService';
export { InventoryImageService, type UploadImageParams, type UploadImageResult, type ImageWithBase64 } from './InventoryImageService';

// Document Services
export { InvoiceService, type InvoiceQueryParams, type IssueInvoiceParams } from './InvoiceService';
export { QuotationService, type QuotationQueryParams } from './QuotationService';
export { CreditNoteService, type CreditNoteQueryParams } from './CreditNoteService';
export { DocumentLineItemService, type DocumentLineItemQueryParams } from './DocumentLineItemService';
export { BillService, type BillQueryParams } from './BillService';

// Credit & Search Services
export { CreditCheckService, type CreditCheckResult, type CreditIssue, type ArrearsInfo } from './CreditCheckService';
export { SpotlightService, type SpotlightResult, type SpotlightSearchParams } from './SpotlightService';

// Payment Services
export { PaymentService, PaymentMethodService, type PaymentQueryParams, type PaymentDocumentType } from './PaymentService';
export { GctPaymentService, type GctPaymentQueryParams } from './GctPaymentService';

// Employee Services
export { EmployeeAttendanceService, type AttendanceQueryParams } from './EmployeeAttendanceService';
export { EmployeeShiftsService } from './EmployeeShiftsService';

// Print Service
export { PrintService, type PrintResult } from './PrintService';

// System Settings
export {
  SystemSettingsService,
  SystemSettingKeys,
  SystemSettingGroups,
  type SystemSettingKey,
  type SystemSettingGroup,
} from './SystemSettingsService';
