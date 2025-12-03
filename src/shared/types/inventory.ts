/**
 * Shared inventory and document line item types
 * Used by both frontend and backend
 */

/**
 * Inventory item from the inventory table
 */
export interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  isTaxable: boolean;
  location?: string | null;
  unit?: string;
  category?: string | null;
  model?: string | null;
  wholesalePrice?: string | null;
}

/**
 * Variant item from the variants table
 */
export interface VariantItem {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
  attributes: Record<string, unknown>;
  description: string | null;
  quantity: number;
  cost: string | null;
  price: string | null;
  wholesalePrice: string | null;
  isActive: boolean;
}

/**
 * Unified inventory search result that can be either an inventory item or variant
 */
export interface InventorySearchResult {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  isTaxable: boolean;
  isVariant: boolean;
  parentSku?: string | null;
  variantName?: string | null;
}

/**
 * Line item for invoices, quotations, and credit notes
 */
export interface LineItem {
  id: string; // Temp ID for UI
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  isTaxable: boolean;
  amount: number;
  inventoryId?: number;
  isVariant?: boolean; // Optional, defaults to false
}

/**
 * Line item data for creating/updating document line items in the database
 */
export interface DocumentLineItemData {
  documentType: 'INVOICE' | 'QUOTE' | 'CREDIT';
  documentNumber: string;
  lineNumber: number;
  sku: string | null;
  isVariant: boolean;
  description: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  isTaxable: boolean;
  amount: string;
}

/**
 * Client information for invoices
 */
export interface Client {
  id: number;
  clientName: string;
  clNumber: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  isTaxable: boolean;
  discountPct: string;
  creditLimit: string;
  creditTerms: string | null;
  isBadCredit: boolean;
}

/**
 * Credit check result for clients
 */
export interface CreditIssue {
  type: 'BAD_CREDIT' | 'OVER_LIMIT' | 'OVERDUE_INVOICES';
  message: string;
}

export interface CreditCheckResult {
  canCreateInvoice: boolean;
  requiresAdminOverride: boolean;
  reasons: CreditIssue[];
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
}

/**
 * Admin override result
 */
export interface AdminOverrideResult {
  adminId: number;
  notes: string;
}

/**
 * Invoice totals
 */
export interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

/**
 * Default tax rate (fallback when database setting is unavailable)
 * The actual tax rate should be fetched from system settings via GET_TAX_RATE IPC
 */
export const DEFAULT_TAX_RATE = 0.15; // 15% GCT
export const TAX_RATE = DEFAULT_TAX_RATE; // Legacy alias for backwards compatibility

/**
 * Format currency helper
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
