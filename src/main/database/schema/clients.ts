import { pgTable, varchar, text, integer, serial, numeric, boolean, timestamp, index } from 'drizzle-orm/pg-core';

// CLIENT table - customer master data
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  clNumber: varchar('cl_number', { length: 20 }),
  clientName: varchar('client_name', { length: 100 }).notNull(),
  contact: varchar('contact', { length: 100 }),
  address1: varchar('address1', { length: 200 }),
  address2: varchar('address2', { length: 200 }),
  phone: varchar('phone', { length: 100 }),
  notes: text('notes'),
  credit: numeric('credit', { precision: 15, scale: 2 }).notNull().default('0'),
  creditDesc: varchar('credit_desc', { length: 200 }),
  isTaxable: boolean('is_taxable').notNull().default(true),
  discountPct: numeric('discount_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  creditLimit: numeric('credit_limit', { precision: 15, scale: 2 }).notNull().default('0'),
  creditTerms: varchar('credit_terms', { length: 50 }),
  custom1: varchar('custom1', { length: 100 }),
  custom2: varchar('custom2', { length: 100 }),
  lbDisc: numeric('lb_disc', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_clients_name').on(table.clientName),
  index('idx_clients_cl_number').on(table.clNumber),
]);

// Export types
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
