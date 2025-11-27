import { pgTable, varchar, integer, serial } from 'drizzle-orm/pg-core';
import { parts } from './parts';

// VEHICLE_MODEL table
export const vehicleModels = pgTable('vehicle_models', {
  id: serial('id').primaryKey(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull()
});

// PART_MODEL junction table
export const partModels = pgTable('part_models', {
  id: serial('id').primaryKey(),
  partId: integer('part_id')
    .notNull()
    .references(() => parts.id, { onDelete: 'cascade' }),
  vehicleModelId: integer('vehicle_model_id')
    .notNull()
    .references(() => vehicleModels.id, { onDelete: 'cascade' }),
  yearStart: varchar('year_start', { length: 4 }),
  yearEnd: varchar('year_end', { length: 4 }),
});

// Export types
export type VehicleModel = typeof vehicleModels.$inferSelect;
export type InsertVehicleModel = typeof vehicleModels.$inferInsert;

export type PartModel = typeof partModels.$inferSelect;
export type InsertPartModel = typeof partModels.$inferInsert;
