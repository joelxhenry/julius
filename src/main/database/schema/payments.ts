import { pgTable, varchar, integer, serial, numeric, boolean, timestamp, date, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { invoices } from './invoices';
import { creditNotes } from './creditNotes';
import { bills } from './bills';
import { employees } from './employees';

// PAYMENT_METHOD table - payment method lookup
export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  active: boolean('active').notNull().default(true),
});

// PAYMENTS table - unified payments for invoices, credit notes, and bills
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  documentType: varchar('document_type', { length: 10 }).notNull(), // 'INVOICE', 'CREDIT', 'BILL'
  documentNumber: varchar('document_number', { length: 50 }).notNull(),

  // Nullable FKs - only one should be set based on document_type
  invoiceNumber: varchar('invoice_number', { length: 20 })
    .references(() => invoices.invNumber, { onDelete: 'cascade' }),
  creditNoteNumber: varchar('credit_note_number', { length: 20 })
    .references(() => creditNotes.crNumber, { onDelete: 'cascade' }),
  billNumber: varchar('bill_number', { length: 50 })
    .references(() => bills.billNo, { onDelete: 'cascade' }),

  payerName: varchar('payer_name', { length: 100 }),
  paymentDate: date('payment_date'),
  paymentDesc: varchar('payment_desc', { length: 100 }),
  paymentDesc2: varchar('payment_desc2', { length: 100 }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 10 }),

  // Employee who processed the payment (nullable for existing data)
  processedById: integer('processed_by_id').references(() => employees.id),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_payments_type_number').on(table.documentType, table.documentNumber),
  index('idx_payments_date').on(table.paymentDate),
  index('idx_payments_invoice').on(table.invoiceNumber),
  index('idx_payments_credit').on(table.creditNoteNumber),
  index('idx_payments_bill').on(table.billNumber),
  index('idx_payments_processed_by').on(table.processedById),
  check('payments_type_check', sql`${table.documentType} IN ('INVOICE', 'CREDIT', 'BILL')`),
  // Note: The FK consistency check from POSTGRES_SCHEMA.md would require a trigger in PostgreSQL
  // as Drizzle doesn't support complex check constraints involving multiple columns
]);

// Export types
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
