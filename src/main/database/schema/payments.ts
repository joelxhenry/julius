import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { invoices } from './invoices';
import { employees } from './employees';

// PAYMENT_METHOD table
export const paymentMethods = sqliteTable('payment_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

// PAYMENT table
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  paymentMethodId: integer('payment_method_id')
    .notNull()
    .references(() => paymentMethods.id, { onDelete: 'restrict' }),
  amount: real('amount').notNull(),
  paidAt: text('paid_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Export types
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
