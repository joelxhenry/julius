import { z } from 'zod';

// Client validation schema
export const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address1: z.string().optional(),
  address2: z.string().optional(),
  creditLimit: z.number().min(0, 'Credit limit must be positive').default(0),
  discountRate: z.number().min(0, 'Discount must be positive').max(100, 'Discount cannot exceed 100%').default(0),
});

export type ClientFormData = z.infer<typeof clientSchema>;

// Part validation schema
export const partSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  category: z.string().optional(),
  description: z.string().optional(),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().min(0, 'Price must be positive').default(0),
  taxable: z.boolean().default(true),
});

export type PartFormData = z.infer<typeof partSchema>;

// Part Variant validation schema
export const partVariantSchema = z.object({
  partId: z.number().min(1, 'Part is required'),
  name: z.string().min(1, 'Variant name is required'),
  description: z.string().optional(),
  isGeneric: z.boolean().default(false),
  price: z.number().min(0, 'Price must be positive').default(0),
  stockQty: z.number().int().min(0, 'Stock quantity must be positive').default(0),
  reorderLevel: z.number().int().min(0, 'Reorder level must be positive').default(0),
  active: z.boolean().default(true),
  barcode: z.string().optional(),
  location: z.string().optional(),
});

export type PartVariantFormData = z.infer<typeof partVariantSchema>;

// Employee validation schema
export const employeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  title: z.string().optional(),
  roleId: z.number().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
});

export type EmployeeFormData = z.infer<typeof employeeSchema>;

// Invoice validation schema
export const invoiceSchema = z.object({
  clientId: z.number().min(1, 'Client is required').optional(),
  employeeId: z.number().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'CANCELLED']).default('DRAFT'),
  subtotal: z.number().min(0).default(0),
  taxTotal: z.number().min(0).default(0),
  discountTotal: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
  balance: z.number().min(0).default(0),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Invoice Item validation schema
export const invoiceItemSchema = z.object({
  invoiceId: z.number().min(1, 'Invoice is required'),
  variantId: z.number().min(1, 'Part variant is required').optional(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be positive'),
  discount: z.number().min(0).max(100).default(0),
  tax: z.number().min(0).max(100).default(0),
});

export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;

// Payment validation schema
export const paymentSchema = z.object({
  invoiceId: z.number().min(1, 'Invoice is required'),
  employeeId: z.number().optional(),
  paymentMethodId: z.number().min(1, 'Payment method is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
});

export type PaymentFormData = z.infer<typeof paymentSchema>;

// Quotation validation schema
export const quotationSchema = z.object({
  clientId: z.number().min(1, 'Client is required').optional(),
  employeeId: z.number().optional(),
  total: z.number().min(0).default(0),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'EXPIRED', 'CONVERTED']).default('DRAFT'),
});

export type QuotationFormData = z.infer<typeof quotationSchema>;

// Credit Note validation schema
export const creditNoteSchema = z.object({
  clientId: z.number().min(1, 'Client is required'),
  invoiceId: z.number().optional(),
  employeeId: z.number().optional(),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  remainingAmount: z.number().min(0).default(0),
  status: z.enum(['OPEN', 'PARTIAL', 'CLOSED']).default('OPEN'),
  reason: z.string().optional(),
});

export type CreditNoteFormData = z.infer<typeof creditNoteSchema>;
