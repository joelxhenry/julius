import { pgTable, varchar, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { employees } from './employees';
import { partVariants } from './parts';

// QUOTATION table
export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// QUOTATION_ITEM table
export const quotationItems = pgTable('quotation_items', {
  id: serial('id').primaryKey(),
  quotationId: integer('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
});

// Export types
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;
