import { pgTable, varchar, integer, serial, numeric, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { employees } from './employees';
import { invoices } from './invoices';

// CREDIT_NOTE table - credit notes for returns/adjustments
export const creditNotes = pgTable('credit_notes', {
  id: serial('id').primaryKey(),
  crNumber: varchar('cr_number', { length: 20 }).notNull().unique(),
  invNumber: varchar('inv_number', { length: 20 })
    .references(() => invoices.invNumber, { onDelete: 'set null' }),
  crDate: date('cr_date').notNull(),
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
  totalUsed: numeric('total_used', { precision: 15, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 10 }).notNull().default('A'),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_crnotes_number').on(table.crNumber),
  index('idx_crnotes_inv').on(table.invNumber),
  index('idx_crnotes_date').on(table.crDate),
  index('idx_crnotes_client').on(table.clientName),
  index('idx_crnotes_client_id').on(table.clientId),
  index('idx_crnotes_archived').on(table.isArchived),
]);

// Export types
export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = typeof creditNotes.$inferInsert;
