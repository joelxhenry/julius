import { pgTable, varchar, text, integer, serial, numeric, boolean, timestamp, index, unique, jsonb, date, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { categories } from './categories';
import { suppliers } from './suppliers';

// INVENTORY table - main inventory/parts table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull().unique(),
  location: varchar('location', { length: 20 }),
  description1: varchar('description1', { length: 200 }),
  description2: varchar('description2', { length: 200 }),
  quantity: integer('quantity').notNull().default(0),
  minLevel: integer('min_level').notNull().default(0),
  isTaxable: boolean('is_taxable').notNull().default(true),
  cost: numeric('cost', { precision: 15, scale: 2 }).notNull().default('0'),
  costCurrency: varchar('cost_currency', { length: 10 }).notNull().default('JA'),
  price: numeric('price', { precision: 15, scale: 2 }).notNull().default('0'),
  priceCurrency: varchar('price_currency', { length: 10 }).notNull().default('JA'),
  margin: numeric('margin', { precision: 8, scale: 4 }),
  unit: varchar('unit', { length: 10 }).notNull().default('EA'),
  category: varchar('category', { length: 100 }),
  model: varchar('model', { length: 200 }),
  wholesalePrice: numeric('wholesale_price', { precision: 15, scale: 2 }),
  icheck: varchar('icheck', { length: 10 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inventory_sku').on(table.sku),
  index('idx_inventory_category').on(table.category),
  index('idx_inventory_location').on(table.location),
]);

// VARIANTS table - part variants with flexible JSONB attributes
export const variants = pgTable('variants', {
  id: serial('id').primaryKey(),
  parentSku: varchar('parent_sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  variantSku: varchar('variant_sku', { length: 50 }).notNull().unique(),
  variantName: varchar('variant_name', { length: 100 }),
  variantType: varchar('variant_type', { length: 50 }), // 'size', 'color', 'specification'
  attributes: jsonb('attributes').notNull().default({}),
  description: varchar('description', { length: 200 }),
  quantity: integer('quantity').notNull().default(0),
  cost: numeric('cost', { precision: 15, scale: 2 }),
  costCurrency: varchar('cost_currency', { length: 10 }).notNull().default('JA'),
  price: numeric('price', { precision: 15, scale: 2 }),
  priceCurrency: varchar('price_currency', { length: 10 }).notNull().default('JA'),
  wholesalePrice: numeric('wholesale_price', { precision: 15, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_variants_parent_sku').on(table.parentSku),
  index('idx_variants_variant_sku').on(table.variantSku),
  index('idx_variants_type').on(table.variantType),
  index('idx_variants_active').on(table.isActive),
]);

// INVENTORY_ALTERNATES table - alternate part numbers
export const inventoryAlternates = pgTable('inventory_alternates', {
  id: serial('id').primaryKey(),
  partNo: varchar('part_no', { length: 50 }).notNull(),
  alternateNo: varchar('alternate_no', { length: 50 }).notNull(),
  supplier: varchar('supplier', { length: 100 }),
}, (table) => [
  unique('inv_alt_unique').on(table.partNo, table.alternateNo),
  index('idx_inv_alt_partno').on(table.partNo),
  index('idx_inv_alt_altno').on(table.alternateNo),
]);

// INVENTORY_CATEGORIES junction table - many-to-many between inventory and categories
export const inventoryCategories = pgTable('inventory_categories', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => [
  unique('inv_cat_unique').on(table.sku, table.categoryId),
  index('idx_inv_cat_sku').on(table.sku),
  index('idx_inv_cat_category_id').on(table.categoryId),
]);

// INVENTORY_MARKUP table - markup pricing
export const inventoryMarkup = pgTable('inventory_markup', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 50 }),
  sku: varchar('sku', { length: 50 })
    .references(() => inventory.sku, { onDelete: 'set null' }),
  description: varchar('description', { length: 200 }),
  retailPrice: numeric('retail_price', { precision: 15, scale: 2 }),
  quantity: integer('quantity'),
}, (table) => [
  index('idx_inv_markup_sku').on(table.sku),
]);

// INVENTORY_TRANSACTIONS table - inventory movement tracking
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  activity: varchar('activity', { length: 20 }).notNull(),
  reference: varchar('reference', { length: 50 }),
  quantity: integer('quantity').notNull(),
  activityDate: date('activity_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inv_trans_sku').on(table.sku),
  index('idx_inv_trans_date').on(table.activityDate),
  index('idx_inv_trans_reference').on(table.reference),
]);

// INVENTORY_RECEIVING table - receiving records from suppliers
export const inventoryReceiving = pgTable('inventory_receiving', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  supplier: varchar('supplier', { length: 100 })
    .references(() => suppliers.company, { onDelete: 'set null' }),
  receivingDate: date('receiving_date'),
  quantity: integer('quantity'),
  lastCost: numeric('last_cost', { precision: 15, scale: 2 }),
  lastCostCurrency: varchar('last_cost_currency', { length: 10 }),
  priorCost: numeric('prior_cost', { precision: 15, scale: 2 }),
  priorCostCurrency: varchar('prior_cost_currency', { length: 10 }),
  lastPrice: numeric('last_price', { precision: 15, scale: 2 }),
  lastPriceCurrency: varchar('last_price_currency', { length: 10 }),
  lastWholesalePrice: numeric('last_wholesale_price', { precision: 15, scale: 2 }),
  reference: varchar('reference', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inv_rec_sku').on(table.sku),
  index('idx_inv_rec_supplier').on(table.supplier),
]);

// Export types
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

export type Variant = typeof variants.$inferSelect;
export type InsertVariant = typeof variants.$inferInsert;

export type InventoryAlternate = typeof inventoryAlternates.$inferSelect;
export type InsertInventoryAlternate = typeof inventoryAlternates.$inferInsert;

export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = typeof inventoryCategories.$inferInsert;

export type InventoryMarkup = typeof inventoryMarkup.$inferSelect;
export type InsertInventoryMarkup = typeof inventoryMarkup.$inferInsert;

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = typeof inventoryTransactions.$inferInsert;

export type InventoryReceiving = typeof inventoryReceiving.$inferSelect;
export type InsertInventoryReceiving = typeof inventoryReceiving.$inferInsert;
