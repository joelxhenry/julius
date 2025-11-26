import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { employees } from './employees';
import { partVariants } from './parts';

// INVOICE table
export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  legacyId: integer('legacy_id').unique(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  status: text('status').notNull(),
  subtotal: real('subtotal').notNull(),
  taxTotal: real('tax_total').notNull(),
  discountTotal: real('discount_total').notNull(),
  total: real('total').notNull(),
  amountPaid: real('amount_paid').notNull().default(0.0),
  balance: real('balance').notNull(),
  isHistorical: integer('is_historical').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// INVOICE_ITEM table
export const invoiceItems = sqliteTable('invoice_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  legacyId: integer('legacy_id').unique(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  price: real('price').notNull(),
  discount: real('discount').notNull().default(0.0),
  tax: real('tax').notNull().default(0.0),
});

// Export types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;
