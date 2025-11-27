import { pgTable, varchar, integer, serial, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';
import { invoices } from './invoices';
import { employees } from './employees';

// PAYMENT_METHOD table
export const paymentMethods = pgTable('payment_methods', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  active: boolean('active').notNull().default(true),
});

// PAYMENT table
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  legacyId: integer('legacy_id').unique(),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  paymentMethodId: integer('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at').notNull().defaultNow(),
});

// Export types
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
