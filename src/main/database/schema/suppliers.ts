import { pgTable, varchar, text, serial, numeric, boolean, timestamp, index } from 'drizzle-orm/pg-core';

// SUPPLIERS table - vendor/supplier master data
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  company: varchar('company', { length: 100 }).notNull().unique(),
  address1: varchar('address1', { length: 200 }),
  address2: varchar('address2', { length: 200 }),
  address3: varchar('address3', { length: 200 }),
  phone1: varchar('phone1', { length: 50 }),
  phone2: varchar('phone2', { length: 50 }),
  fax: varchar('fax', { length: 50 }),
  email1: varchar('email1', { length: 200 }),
  email2: varchar('email2', { length: 200 }),
  contact1: varchar('contact1', { length: 100 }),
  contact2: varchar('contact2', { length: 100 }),
  notes: text('notes'),
  credit: numeric('credit', { precision: 15, scale: 2 }),
  creditDesc: varchar('credit_desc', { length: 200 }),
  isTaxable: boolean('is_taxable'),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }),
  terms: varchar('terms', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_suppliers_company').on(table.company),
  index('idx_suppliers_active').on(table.isActive),
]);

// Export types
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;
