import { pgTable, varchar, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { users } from './users';
import { partVariants } from './parts';

// QUOTATION table
export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),

  quotationNumber: varchar('quotation_number', { length: 100 }).notNull().unique(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),


  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 50 }).notNull(),


  reference: varchar('reference', { length: 100 }),


  isTaxable: integer('is_taxable').notNull().default(1),

  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  taxTotal: numeric('tax_total', { precision: 10, scale: 2 }).notNull(),
  discountTotal: numeric('discount_total', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 10, scale: 2 }).notNull().default('0.00'),


  is_wholesale: integer('is_wholesale').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow()
});

// QUOTATION_ITEM table
export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
    variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
    quantity: integer('quantity').notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0.00'),
    tax: numeric('tax', { precision: 10, scale: 2 }).notNull().default('0.00'),
});

// Export types
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;
