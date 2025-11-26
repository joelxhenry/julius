import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { partVariants } from './parts';

// LOCATION table
export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  description: text('description'),
});

// PART_LOCATION junction table
export const partLocations = sqliteTable('part_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  variantId: integer('variant_id')
    .notNull()
    .references(() => partVariants.id, { onDelete: 'cascade' }),
  locationId: integer('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(0),
});

// Export types
export type Location = typeof locations.$inferSelect;
export type InsertLocation = typeof locations.$inferInsert;

export type PartLocation = typeof partLocations.$inferSelect;
export type InsertPartLocation = typeof partLocations.$inferInsert;
