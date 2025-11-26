import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// CLIENT table
export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  legacyId: integer('legacy_id').unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email').unique(),
  address1: text('address1'),
  address2: text('address2'),
  creditLimit: real('credit_limit').notNull().default(0.0),
  discountRate: real('discount_rate').notNull().default(0.0),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Export types
export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;
