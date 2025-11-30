import { pgTable, integer, serial, numeric, unique } from 'drizzle-orm/pg-core';

// GCT_PAYMENTS table - government tax payments tracking
export const gctPayments = pgTable('gct_payments', {
  id: serial('id').primaryKey(),
  month: integer('month'),
  year: integer('year'),
  deduction: numeric('deduction', { precision: 15, scale: 2 }),
  amount: numeric('amount', { precision: 15, scale: 2 }),
}, (table) => [
  unique('gct_payments_month_year').on(table.month, table.year),
]);

// Export types
export type GctPayment = typeof gctPayments.$inferSelect;
export type InsertGctPayment = typeof gctPayments.$inferInsert;
