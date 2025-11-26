import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { employees } from './employees';
import { partVariants } from './parts';

// QUOTATION table
export const quotations = sqliteTable('quotations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id').references(() => clients.id, { onDelete: 'set null' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  total: real('total').notNull(),
  status: text('status').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// QUOTATION_ITEM table
export const quotationItems = sqliteTable('quotation_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quotationId: integer('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  variantId: integer('variant_id').references(() => partVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull(),
  price: real('price').notNull(),
});

// Export types
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = typeof quotationItems.$inferInsert;
