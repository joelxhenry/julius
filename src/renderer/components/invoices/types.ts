// Re-export shared types for backwards compatibility
export {
  type InventoryItem,
  type InventorySearchResult,
  type LineItem,
  type Client,
  type InvoiceTotals,
  TAX_RATE,
  formatCurrency,
} from '../../../shared/types/inventory';

// Re-export CreditIssue and AdminOverrideResult from AdminOverrideModal
export type { CreditIssue, AdminOverrideResult } from './AdminOverrideModal';

// Import CreditIssue type for use in CreditCheckResult
import type { CreditIssue } from './AdminOverrideModal';

/**
 * Credit check result from the CHECK_CLIENT_CREDIT IPC call
 */
export interface CreditCheckResult {
  canCreateInvoice: boolean;
  requiresAdminOverride: boolean;
  reasons: CreditIssue[];
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
}
