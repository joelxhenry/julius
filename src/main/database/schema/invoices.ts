import { pgTable, varchar, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { partVariants } from './parts';
import { users } from './users';

// INVOICE table
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),

  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),


  clientName: varchar('client_name', { length: 255 }),
  clientAddress1: varchar('client_address_1', { length: 255 }),
  clientAddress2: varchar('client_address_2', { length: 255 }),
  clientPhone: varchar('client_phone', { length: 50 }),
  clientEmail: varchar('client_email', { length: 100 }),


  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).notNull(),


  reference: varchar('reference', { length: 100 }),


  isTaxable: integer('is_taxable').notNull().default(1),

  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxTotal: numeric('tax_total', { precision: 10, scale: 2 }).notNull(),
  discountTotal: numeric('discount_total', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0.00'),


  credit_terms: integer('credit_terms').notNull().default(0),

  is_wholesale: integer('is_wholesale').notNull().default(0),

  isHistorical: integer('is_historical').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// INVOICE_ITEM table
export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),

  variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0.00'),
  tax: numeric('tax', { precision: 10, scale: 2 }).notNull().default('0.00'),
});

// Export types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = typeof invoiceItems.$inferInsert;
