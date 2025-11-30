import { pgTable, varchar, integer, serial, numeric, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { employees } from './employees';

// INVOICE table - sales invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invNumber: varchar('inv_number', { length: 20 }).notNull().unique(),
  invDate: date('inv_date').notNull(),
  invTime: integer('inv_time'),
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
  totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 10 }).notNull().default('A'),
  isTaxable: boolean('is_taxable').notNull().default(true),
  pricing: varchar('pricing', { length: 10 }).notNull().default('R'),
  creditTerms: varchar('credit_terms', { length: 50 }),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_invoices_number').on(table.invNumber),
  index('idx_invoices_date').on(table.invDate),
  index('idx_invoices_client').on(table.clientName),
  index('idx_invoices_client_id').on(table.clientId),
  index('idx_invoices_salesperson').on(table.salespersonId),
  index('idx_invoices_status').on(table.status),
  index('idx_invoices_archived').on(table.isArchived),
]);

// Export types
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;
