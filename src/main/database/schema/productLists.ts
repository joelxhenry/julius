import { pgTable, serial, integer, varchar, text, boolean, timestamp, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './employees';

// Product list status flow: open -> ordered -> archived
// A list represents a single order cycle: parts are collected while 'open',
// stamped 'ordered' (orderedAt) once purchased, then 'archived' when done.
export type ProductListStatus = 'open' | 'ordered' | 'archived';

// PRODUCT_LISTS table - named, shared "reorder pad" collections of products.
// Not a sales document; a lightweight notepad used to track what needs ordering.
export const productLists = pgTable('product_lists', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 150 }).notNull(),
  note: text('note'),

  // open -> ordered -> archived
  status: varchar('status', { length: 20 }).notNull().default('open'),

  // Creator tracking (lists are shared, but each shows who made it)
  createdByEmployeeId: integer('created_by_employee_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  createdByName: varchar('created_by_name', { length: 100 }),

  // Stamped when status transitions to 'ordered'
  orderedAt: timestamp('ordered_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_product_lists_status').on(table.status),
  index('idx_product_lists_created_by').on(table.createdByEmployeeId),
  check('product_lists_status_check', sql`${table.status} IN ('open', 'ordered', 'archived')`),
]);

// PRODUCT_LIST_ITEMS table - products attached to a list.
// Note: sku can reference either inventory.sku or variants.variant_sku (like
// document_line_items). No foreign key so both are allowed.
export const productListItems = pgTable('product_list_items', {
  id: serial('id').primaryKey(),
  listId: integer('list_id')
    .notNull()
    .references(() => productLists.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 50 }).notNull(), // inventory SKU or variant SKU
  isVariant: boolean('is_variant').notNull().default(false),
  description: varchar('description', { length: 200 }), // snapshot for stable display/export
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => [
  unique('product_list_items_unique').on(table.listId, table.sku, table.isVariant),
  index('idx_product_list_items_list').on(table.listId),
  index('idx_product_list_items_sku').on(table.sku),
]);

// Export types
export type ProductList = typeof productLists.$inferSelect;
export type InsertProductList = typeof productLists.$inferInsert;
export type ProductListItem = typeof productListItems.$inferSelect;
export type InsertProductListItem = typeof productListItems.$inferInsert;
