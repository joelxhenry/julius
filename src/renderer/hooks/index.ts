// Database hooks
export { useDatabaseSettings } from './useDatabaseSettings';

// Keyboard hooks
export { useKeyboardShortcuts } from './useKeyboardShortcuts';
export type { KeyboardShortcut } from './useKeyboardShortcuts';

// Auth hooks
export { useIdleTimeout } from './useIdleTimeout';
export { useProtectedNavigation } from './useProtectedNavigation';

// Inventory hooks
export { useInventory } from './useInventory';
export type {
  InventoryItem,
  InventoryQueryParams,
  CreateInventoryData,
  UpdateInventoryData,
} from './useInventory';

export { useVariants } from './useVariants';
export type {
  Variant,
  VariantQueryParams,
  CreateVariantData,
  UpdateVariantData,
} from './useVariants';

export { useInventoryAlternates } from './useInventoryAlternates';
export type {
  InventoryAlternate,
  CreateAlternateData,
} from './useInventoryAlternates';

export { useInventoryImages, usePreloadThumbnails } from './useInventoryImages';
export type {
  InventoryImage,
  InventoryImageWithData,
  UseInventoryImagesOptions,
  UseInventoryImagesReturn,
} from './useInventoryImages';

export { useAllInventoryImages } from './useAllInventoryImages';
export type {
  AllProductImagesResult,
  UseAllInventoryImagesOptions,
  UseAllInventoryImagesReturn,
} from './useAllInventoryImages';

// System settings hooks
export { useTaxRate } from './useTaxRate';

// Invoice/Form hooks
export { useClientSearch } from './useClientSearch';
export type { Client, ClientOption } from './useClientSearch';

export { useInventorySearch } from './useInventorySearch';
export type { InventorySearchItem, InventoryOption } from './useInventorySearch';

export { useLineItems } from './useLineItems';
export type { LineItem } from './useLineItems';

export { useInvoiceForm } from './useInvoiceForm';
export type { InvoiceFormState, InvoiceFormActions } from './useInvoiceForm';

export { useInvoiceSubmit } from './useInvoiceSubmit';

export { useInvoiceKeyboardShortcuts } from './useInvoiceKeyboardShortcuts';
