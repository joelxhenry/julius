// Service hooks
export { useClients } from './useClients';
export { useUsers } from './useUsers';
export { useParts } from './useParts';
export { usePartVariants } from './usePartVariants';
export { useInvoices } from './useInvoices';
export { useInvoiceItems } from './useInvoiceItems';
export { usePayments } from './usePayments';
export { usePaymentMethods } from './usePaymentMethods';
export { useQuotations } from './useQuotations';
export { useQuotationItems } from './useQuotationItems';
export { useCreditNotes } from './useCreditNotes';
export { useCreditNoteAllocations } from './useCreditNoteAllocations';
export { useDatabaseSettings } from './useDatabaseSettings';

// Legacy hooks for backwards compatibility
export { useUsers as useLegacyUsers, useNotes } from './useDatabase';
