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

export interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  isTaxable: boolean;
}

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
}

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

export interface AdminOverrideResult {
  adminId: number;
  notes: string;
}

export interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

export const TAX_RATE = 0.15; // 15% GCT

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};
