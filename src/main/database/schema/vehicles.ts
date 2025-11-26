import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { parts } from './parts';

// VEHICLE_MODEL table
export const vehicleModels = sqliteTable('vehicle_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  make: text('make').notNull(),
  model: text('model').notNull()
});

// PART_MODEL junction table
export const partModels = sqliteTable('part_models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partId: integer('part_id')
    .notNull()
    .references(() => parts.id, { onDelete: 'cascade' }),
  vehicleModelId: integer('vehicle_model_id')
    .notNull()
    .references(() => vehicleModels.id, { onDelete: 'cascade' }),
  yearStart: text('year_start'),
  yearEnd: text('year_end'),
});

// Export types
export type VehicleModel = typeof vehicleModels.$inferSelect;
export type InsertVehicleModel = typeof vehicleModels.$inferInsert;

export type PartModel = typeof partModels.$inferSelect;
export type InsertPartModel = typeof partModels.$inferInsert;
