import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// PART table
export const parts = sqliteTable('parts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
  sku: text('sku').notNull().unique(),
  price: real('price').notNull(),
  taxable: integer('taxable', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// PART_VARIANT table
export const partVariants = sqliteTable('part_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partId: integer('part_id')
    .notNull()
    .references(() => parts.id, { onDelete: 'cascade' }),
  name: text('name'),
  description: text('description'),
  isGeneric: integer('is_generic', { mode: 'boolean' }).notNull().default(false),
  price: real('price').notNull(),
  stockQty: integer('stock_qty').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  barcode: text('barcode').unique(),
  location: text('location'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Export types
export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;

export type PartVariant = typeof partVariants.$inferSelect;
export type InsertPartVariant = typeof partVariants.$inferInsert;
