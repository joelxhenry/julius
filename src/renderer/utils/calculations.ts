/**
 * Invoice and transaction calculation utilities
 */

export interface LineItem {
  partVariantId: number;
  partName?: string;
  quantity: number;
  unitPrice: string | number;
  discount: string | number;
  taxRate: string | number;
}

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

/**
 * Calculate the total for a single line item
 * Formula: (quantity * unitPrice) - discount + tax
 */
export function calculateLineTotal(item: LineItem): number {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const discount = Number(item.discount) || 0;
  const taxRate = Number(item.taxRate) || 0;

  const lineSubtotal = quantity * unitPrice;
  const lineAfterDiscount = lineSubtotal - discount;
  const lineTax = lineAfterDiscount * (taxRate / 100);
  const lineTotal = lineAfterDiscount + lineTax;

  return lineTotal;
}

/**
 * Calculate totals for an entire invoice or quotation
 */
export function calculateInvoiceTotals(items: LineItem[]): InvoiceTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  items.forEach((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.taxRate) || 0;

    const lineSubtotal = quantity * unitPrice;
    const lineAfterDiscount = lineSubtotal - discount;
    const lineTax = lineAfterDiscount * (taxRate / 100);

    subtotal += lineSubtotal;
    discountTotal += discount;
    taxTotal += lineTax;
  });

  const total = subtotal - discountTotal + taxTotal;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    total,
  };
}

/**
 * Calculate the balance remaining on an invoice after payments
 */
export function calculateBalance(total: number, payments: number[]): number {
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment), 0);
  return total - totalPaid;
}

/**
 * Determine invoice status based on total and balance
 */
export function determineInvoiceStatus(total: number, balance: number, dueDate?: string | Date): string {
  if (balance <= 0) {
    return 'PAID';
  }

  if (balance < total) {
    return 'PARTIAL';
  }

  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (now > due) {
      return 'OVERDUE';
    }
  }

  return 'ISSUED';
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number | string): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  return Number(value.replace(/[^0-9.-]+/g, '')) || 0;
}
