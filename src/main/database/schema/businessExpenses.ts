import { pgTable, varchar, integer, serial, numeric, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';
import { employees } from './employees';

// BUSINESS_EXPENSES table - operational costs (rent, utilities, insurance, etc.),
// distinct from `bills` (supplier purchase orders for inventory).
export const businessExpenses = pgTable('business_expenses', {
  id: serial('id').primaryKey(),
  expenseDate: date('expense_date').notNull(),
  payee: varchar('payee', { length: 150 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  description: varchar('description', { length: 200 }),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 15, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0'),
  paymentMethod: varchar('payment_method', { length: 50 }),
  isTaxDeductible: boolean('is_tax_deductible').notNull().default(true),
  referenceNo: varchar('reference_no', { length: 50 }),
  authorizedById: integer('authorized_by_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_business_expenses_date').on(table.expenseDate),
  index('idx_business_expenses_category').on(table.category),
  index('idx_business_expenses_deductible').on(table.isTaxDeductible),
]);

// Export types
export type BusinessExpense = typeof businessExpenses.$inferSelect;
export type InsertBusinessExpense = typeof businessExpenses.$inferInsert;
