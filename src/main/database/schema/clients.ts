import { pgTable, varchar, text, integer, serial, numeric, timestamp } from 'drizzle-orm/pg-core';

// CLIENT table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  legacyId: integer('legacy_id').unique(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }).unique(),
  address1: text('address1'),
  address2: text('address2'),
  creditLimit: numeric('credit_limit', { precision: 10, scale: 2 }).notNull().default('0.00'),
  discountRate: numeric('discount_rate', { precision: 5, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export types
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
