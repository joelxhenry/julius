import { pgTable, varchar, text, serial, boolean } from 'drizzle-orm/pg-core';

// SYSTEM_SETTING table
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  group: varchar('group', { length: 100 }).notNull(),
  description: text('description'),
  readonly: boolean('readonly').notNull().default(false),
  visible: boolean('visible').notNull().default(true),
});

// Export types
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
