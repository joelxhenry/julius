import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { clients } from './clients';
import { invoices } from './invoices';
import { employees } from './employees';

// CREDIT_NOTE table
export const creditNotes = sqliteTable('credit_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  amount: real('amount').notNull(),
  remainingAmount: real('remaining_amount').notNull(),
  status: text('status').notNull(),
  reason: text('reason').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// CREDIT_NOTE_ALLOCATION table
export const creditNoteAllocations = sqliteTable('credit_note_allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  creditNoteId: integer('credit_note_id')
    .notNull()
    .references(() => creditNotes.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  amountApplied: real('amount_applied').notNull(),
  appliedAt: text('applied_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
});

// Export types
export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = typeof creditNotes.$inferInsert;

export type CreditNoteAllocation = typeof creditNoteAllocations.$inferSelect;
export type InsertCreditNoteAllocation = typeof creditNoteAllocations.$inferInsert;
