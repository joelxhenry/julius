import { pgTable, varchar, text, integer, serial, boolean, date } from 'drizzle-orm/pg-core';

// ROLE table
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

// PERMISSION table
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 100 }).notNull(),
  description: text('description').notNull(),
});

// ROLE_PERMISSION junction table
export const rolePermissions = pgTable('role_permissions', {
  id: serial('id').primaryKey(),
  roleId: integer('role_id')
    .notNull()
    .references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: integer('permission_id')
    .notNull()
    .references(() => permissions.id, { onDelete: 'cascade' }),
});

// EMPLOYEE table
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 100 }),
  usingDefaultPin: boolean('using_default_pin').notNull().default(true),
  pinHash: text('pin_hash').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
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
