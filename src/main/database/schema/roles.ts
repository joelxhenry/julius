import { pgTable, serial, varchar, jsonb, boolean, timestamp, index } from 'drizzle-orm/pg-core';

// ROLES table - RBAC. A role holds a set of permission codes; employees are
// assigned a role and inherit its permissions. `isSuperAdmin` grants full access
// (equivalent to the ADMIN bypass) regardless of the individual permission map.
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 60 }).notNull().unique(),
  description: varchar('description', { length: 200 }),

  // Map of permission code -> boolean (same shape as employees.permissions)
  permissions: jsonb('permissions').notNull().default({}),

  // Full-access toggle — bypasses all permission checks when true
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),

  // System roles are seeded and protected from deletion
  isSystem: boolean('is_system').notNull().default(false),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_roles_name').on(table.name),
]);

// Export types
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;
