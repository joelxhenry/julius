import { pgTable, varchar, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { employees } from './employees';
import { partVariants } from './parts';

// INVOICE table
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  legacyId: integer('legacy_id').unique(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).notNull(),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxTotal: numeric('tax_total', { precision: 10, scale: 2 }).notNull(),
  discountTotal: numeric('discount_total', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0.00'),
  balance: numeric('balance', { precision: 10, scale: 2 }).notNull(),
  isHistorical: integer('is_historical').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// INVOICE_ITEM table
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  legacyId: integer('legacy_id').unique(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  tax: numeric('tax', { precision: 10, scale: 2 }).notNull().default('0.00'),
});

// Export types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;
