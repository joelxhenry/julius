import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ROLE table
export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

// PERMISSION table
export const permissions = sqliteTable('permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(),
  description: text('description').notNull(),
});

// ROLE_PERMISSION junction table
export const rolePermissions = sqliteTable('role_permissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
});

// EMPLOYEE table
export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  username: text('username').notNull().unique(),
  usingDefaultPin: integer('using_default_pin', { mode: 'boolean' }).notNull().default(true),
  pinHash: text('pin_hash').notNull(),
  roleId: integer('role_id').references(() => roles.id, { onDelete: 'set null' }),
});

// Export types
export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
