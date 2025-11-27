import { pgTable, varchar, text, integer, serial, numeric, boolean, timestamp } from 'drizzle-orm/pg-core';

// PART table
export const parts = pgTable('parts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  description: text('description'),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  taxable: boolean('taxable').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// PART_VARIANT table
export const partVariants = pgTable('part_variants', {
  id: serial('id').primaryKey(),
  partId: integer('part_id')
    .notNull()
    .references(() => parts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  description: text('description'),
  isGeneric: boolean('is_generic').notNull().default(false),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  stockQty: integer('stock_qty').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  active: boolean('active').notNull().default(true),
  barcode: varchar('barcode', { length: 100 }).unique(),
  location: varchar('location', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export types
export type Part = typeof parts.$inferSelect;
export type InsertPart = typeof parts.$inferInsert;

export type PartVariant = typeof partVariants.$inferSelect;
export type InsertPartVariant = typeof partVariants.$inferInsert;
