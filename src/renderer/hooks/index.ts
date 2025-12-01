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
