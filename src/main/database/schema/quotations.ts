import { pgTable, varchar, text, integer, serial, numeric, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { employees } from './employees';

// QUOTATION table - sales quotations
export const quotations = pgTable('quotations', {
  id: serial('id').primaryKey(),
  quoteNum: varchar('quote_num', { length: 20 }).notNull().unique(),
  quoteDate: date('quote_date').notNull(),
  salespersonId: integer('salesperson_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  clientId: integer('client_id')
    .references(() => clients.id, { onDelete: 'set null' }),

  // Denormalized client data for historical records
  clientName: varchar('client_name', { length: 100 }),
  clientAddress1: varchar('client_address1', { length: 200 }),
  clientAddress2: varchar('client_address2', { length: 200 }),
  clientPhone: varchar('client_phone', { length: 100 }),

  reference: varchar('reference', { length: 100 }),
  subTotal: numeric('sub_total', { precision: 15, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 15, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0'),
  isTaxable: boolean('is_taxable').notNull().default(true),
  pricing: varchar('pricing', { length: 10 }).notNull().default('R'),
  isArchived: boolean('is_archived').notNull().default(false),

  // General notes
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_quotes_number').on(table.quoteNum),
  index('idx_quotes_date').on(table.quoteDate),
  index('idx_quotes_client').on(table.clientName),
  index('idx_quotes_client_id').on(table.clientId),
  index('idx_quotes_archived').on(table.isArchived),
]);

// Export types
export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;
