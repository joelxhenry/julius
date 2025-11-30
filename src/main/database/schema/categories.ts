import { pgTable, varchar, serial, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// CATEGORIES table - merged account_categories + inventory_categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 100 }).notNull(),
  categoryType: varchar('category_type', { length: 20 }).notNull(), // 'account' or 'inventory'
}, (table) => [
  unique('categories_category_type_unique').on(table.category, table.categoryType),
  index('idx_categories_type').on(table.categoryType),
  check('categories_type_check', sql`${table.categoryType} IN ('account', 'inventory')`),
]);

// Export types
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
