import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// SYSTEM_SETTING table
export const systemSettings = sqliteTable('system_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  group: text('group').notNull(),
  description: text('description'),
  readonly: integer('readonly', { mode: 'boolean' }).notNull().default(false),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
});

// Export types
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
