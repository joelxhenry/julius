// Service hooks
export { useClients } from './useClients';
export { useUsers } from './useUsers';
export { useParts } from './useParts';
export { usePartVariants, type PartVariantWithPart } from './usePartVariants';
export { useInvoices, type InvoiceQueryParams, type PaginatedResult } from './useInvoices';
export { useInvoiceItems } from './useInvoiceItems';
export { useInvoiceNavigation, getCachedInvoice } from './useInvoiceNavigation';
export { usePayments } from './usePayments';
export { usePaymentMethods } from './usePaymentMethods';
export { useQuotations } from './useQuotations';
export { useQuotationItems } from './useQuotationItems';
export { useCreditNotes } from './useCreditNotes';
export { useCreditNoteAllocations } from './useCreditNoteAllocations';
export { useDatabaseSettings } from './useDatabaseSettings';

// Legacy hooks for backwards compatibility
export { useUsers as useLegacyUsers, useNotes } from './useDatabase';
