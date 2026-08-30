import { pgTable, serial, integer, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { employees } from './employees';

// ACCESS_OVERRIDES table - audit trail of one-time permission overrides.
// When a logged-in user lacks a permission, another authorised user can grant
// a temporary, single-action override. Each grant is recorded here for auditing.
export const accessOverrides = pgTable('access_overrides', {
  id: serial('id').primaryKey(),

  // The permission code that was overridden (e.g. VOID_PAYMENT)
  permissionCode: varchar('permission_code', { length: 80 }).notNull(),
  // Human-readable label of the action being performed
  actionLabel: varchar('action_label', { length: 160 }),

  // The user who was logged in and needed the override (reverted to afterwards)
  requestedById: integer('requested_by_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  requestedByName: varchar('requested_by_name', { length: 120 }),

  // The authorising user who supplied their access code to grant the override
  grantedById: integer('granted_by_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  grantedByName: varchar('granted_by_name', { length: 120 }),

  // Optional context about what the override applied to (e.g. { entity: 'invoice', id: 42 })
  context: jsonb('context'),
  // Optional reason/notes entered by the grantor
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_access_overrides_permission').on(table.permissionCode),
  index('idx_access_overrides_requested_by').on(table.requestedById),
  index('idx_access_overrides_granted_by').on(table.grantedById),
  index('idx_access_overrides_created').on(table.createdAt),
]);

// Export types
export type AccessOverride = typeof accessOverrides.$inferSelect;
export type InsertAccessOverride = typeof accessOverrides.$inferInsert;
