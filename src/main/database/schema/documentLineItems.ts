import { pgTable, varchar, integer, serial, numeric, boolean, index, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { inventory } from './inventory';

// DOCUMENT_LINE_ITEMS table - unified line items for invoices, quotations, credit notes
export const documentLineItems = pgTable('document_line_items', {
  id: serial('id').primaryKey(),
  documentType: varchar('document_type', { length: 10 }).notNull(), // 'INVOICE', 'QUOTE', 'CREDIT'
  documentNumber: varchar('document_number', { length: 20 }).notNull(),
  lineNumber: integer('line_number').notNull(),
  sku: varchar('sku', { length: 50 })
    .references(() => inventory.sku, { onDelete: 'set null' }),
  description: varchar('description', { length: 200 }),
  quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull().default('0'),
  unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  isTaxable: boolean('is_taxable').notNull().default(true),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull().default('0'),
}, (table) => [
  unique('doc_items_unique').on(table.documentType, table.documentNumber, table.lineNumber),
  index('idx_doc_items_type_number').on(table.documentType, table.documentNumber),
  index('idx_doc_items_sku').on(table.sku),
  check('doc_items_type_check', sql`${table.documentType} IN ('INVOICE', 'QUOTE', 'CREDIT')`),
]);

// Export types
export type DocumentLineItem = typeof documentLineItems.$inferSelect;
export type InsertDocumentLineItem = typeof documentLineItems.$inferInsert;
