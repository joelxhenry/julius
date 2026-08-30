import { pgTable, varchar, integer, serial, numeric, timestamp, date, index } from 'drizzle-orm/pg-core';
import { suppliers } from './suppliers';

// BILLS table - purchase orders/bills from suppliers
export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  billNo: varchar('bill_no', { length: 50 }).notNull().unique(),
  supplier: varchar('supplier', { length: 100 })
    // Cascade on rename so a supplier rename isn't blocked by this constraint.
    .references(() => suppliers.company, { onDelete: 'set null', onUpdate: 'cascade' }),
  billDate: date('bill_date'),
  orderNo: varchar('order_no', { length: 50 }),
  description: varchar('description', { length: 200 }),
  category: varchar('category', { length: 100 }),
  subTotal: numeric('sub_total', { precision: 15, scale: 2 }).notNull().default('0'),
  tax: numeric('tax', { precision: 15, scale: 2 }).notNull().default('0'),
  total: numeric('total', { precision: 15, scale: 2 }).notNull().default('0'),
  billCurrency: varchar('bill_currency', { length: 10 }),
  totalPaid: numeric('total_paid', { precision: 15, scale: 2 }).notNull().default('0'),
  payDate: date('pay_date'),
  orderedBy: varchar('ordered_by', { length: 50 }),
  status: varchar('status', { length: 10 }).notNull().default('A'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_bills_number').on(table.billNo),
  index('idx_bills_supplier').on(table.supplier),
  index('idx_bills_date').on(table.billDate),
]);

// Export types
export type Bill = typeof bills.$inferSelect;
export type InsertBill = typeof bills.$inferInsert;
