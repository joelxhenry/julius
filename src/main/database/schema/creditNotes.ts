import { pgTable, varchar, text, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { invoices } from './invoices';
import { users } from './users';

// CREDIT_NOTE table
export const creditNotes = pgTable('credit_notes', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  remainingAmount: numeric('remaining_amount', { precision: 10, scale: 2 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// CREDIT_NOTE_ALLOCATION table
export const creditNoteAllocations = pgTable('credit_note_allocations', {
  id: serial('id').primaryKey(),
  creditNoteId: integer('credit_note_id')
    .notNull()
    .references(() => creditNotes.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  amountApplied: numeric('amount_applied', { precision: 10, scale: 2 }).notNull(),
  appliedAt: timestamp('applied_at').notNull().defaultNow(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
});

// Export types
export type CreditNote = typeof creditNotes.$inferSelect;
export type InsertCreditNote = typeof creditNotes.$inferInsert;

export type CreditNoteAllocation = typeof creditNoteAllocations.$inferSelect;
export type InsertCreditNoteAllocation = typeof creditNoteAllocations.$inferInsert;
