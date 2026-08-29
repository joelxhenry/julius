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
  location: varchar('location', { length: 20 }),
  attributes: jsonb('attributes').notNull().default({}),
  description: varchar('description', { length: 200 }),
  quantity: integer('quantity').notNull().default(0),
  cost: numeric('cost', { precision: 15, scale: 2 }),
  costCurrency: varchar('cost_currency', { length: 10 }).notNull().default('JA'),
  price: numeric('price', { precision: 15, scale: 2 }),
  priceCurrency: varchar('price_currency', { length: 10 }).notNull().default('JA'),
  wholesalePrice: numeric('wholesale_price', { precision: 15, scale: 2 }),
  isActive: boolean('is_active').notNull().default(true),
  isBase: boolean('is_base').notNull().default(false), // Base variant flag - every inventory item has one
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('idx_variants_parent_sku').on(table.parentSku),
  index('idx_variants_variant_sku').on(table.variantSku),
  index('idx_variants_active').on(table.isActive),
  index('idx_variants_is_base').on(table.isBase),
  index('idx_variants_location').on(table.location),
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
// For variants: sku = parent SKU, variantSku = variant SKU
// For inventory items: sku = inventory SKU, variantSku = null
export const inventoryTransactions = pgTable('inventory_transactions', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  variantSku: varchar('variant_sku', { length: 50 })
    .references(() => variants.variantSku, { onDelete: 'cascade' }),
  activity: varchar('activity', { length: 20 }).notNull(),
  reference: varchar('reference', { length: 50 }),
  quantity: integer('quantity').notNull(),
  activityDate: date('activity_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inv_trans_sku').on(table.sku),
  index('idx_inv_trans_variant_sku').on(table.variantSku),
  index('idx_inv_trans_date').on(table.activityDate),
  index('idx_inv_trans_reference').on(table.reference),
]);

// GOODS_RECEIVALS table - receival header/document. One reference (PO / supplier
// invoice #) groups multiple received line items into a single posted document so
// the whole receival can be reviewed, audited and reprinted as a unit.
export const goodsReceivals = pgTable('goods_receivals', {
  id: serial('id').primaryKey(),
  reference: varchar('reference', { length: 50 }),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id, { onDelete: 'set null' }),
  supplier: varchar('supplier', { length: 100 }),
  receivingDate: date('receiving_date'),
  status: varchar('status', { length: 20 }).notNull().default('posted'),
  notes: text('notes'),
  lineCount: integer('line_count').notNull().default(0),
  totalQuantity: integer('total_quantity').notNull().default(0),
  totalCost: numeric('total_cost', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_goods_rec_reference').on(table.reference),
  index('idx_goods_rec_supplier_id').on(table.supplierId),
  index('idx_goods_rec_date').on(table.receivingDate),
]);

// INVENTORY_RECEIVING table - receiving records from suppliers (one row per line)
export const inventoryReceiving = pgTable('inventory_receiving', {
  id: serial('id').primaryKey(),
  receivalId: integer('receival_id')
    .references(() => goodsReceivals.id, { onDelete: 'set null' }),
  sku: varchar('sku', { length: 50 }).notNull()
    .references(() => inventory.sku, { onDelete: 'cascade' }),
  variantSku: varchar('variant_sku', { length: 50 })
    .references(() => variants.variantSku, { onDelete: 'cascade' }),
  supplierId: integer('supplier_id')
    .references(() => suppliers.id, { onDelete: 'set null' }),
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
  index('idx_inv_rec_variant_sku').on(table.variantSku),
  index('idx_inv_rec_supplier').on(table.supplier),
  index('idx_inv_rec_supplier_id').on(table.supplierId),
  index('idx_inv_rec_receival_id').on(table.receivalId),
]);

// INVENTORY_IMAGES table - product gallery images
export const inventoryImages = pgTable('inventory_images', {
  id: serial('id').primaryKey(),
  sku: varchar('sku', { length: 50 }).notNull(), // inventory SKU or variant SKU
  isVariant: boolean('is_variant').notNull().default(false), // TRUE = variant, FALSE = inventory
  filePath: varchar('file_path', { length: 500 }).notNull(), // relative path from userData
  thumbnailPath: varchar('thumbnail_path', { length: 500 }), // thumbnail relative path
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 50 }),
  isPrimary: boolean('is_primary').notNull().default(false), // primary/cover image
  sortOrder: integer('sort_order').notNull().default(0),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
}, (table) => [
  index('idx_inventory_images_sku').on(table.sku),
  index('idx_inventory_images_variant').on(table.isVariant),
  index('idx_inventory_images_primary').on(table.sku, table.isPrimary),
]);

// Export types
export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

export type Variant = typeof variants.$inferSelect;
export type InsertVariant = typeof variants.$inferInsert;

export type InventoryImage = typeof inventoryImages.$inferSelect;
export type InsertInventoryImage = typeof inventoryImages.$inferInsert;

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

export type GoodsReceival = typeof goodsReceivals.$inferSelect;
export type InsertGoodsReceival = typeof goodsReceivals.$inferInsert;
