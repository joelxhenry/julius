import { pgTable, varchar, text, integer, serial, numeric, boolean, timestamp, date, index, jsonb } from 'drizzle-orm/pg-core';

// EMPLOYEES table - merged employees + salespeople + user access
export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  lastName: varchar('last_name', { length: 50 }),
  firstName: varchar('first_name', { length: 50 }),
  title: varchar('title', { length: 50 }),
  department: varchar('department', { length: 50 }),
  address: text('address'),
  phone: varchar('phone', { length: 50 }),
  emergencyContact: varchar('emergency_contact', { length: 100 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: varchar('status', { length: 20 }),

  // Salesperson fields
  isSalesperson: boolean('is_salesperson').notNull().default(false),
  commission: numeric('commission', { precision: 10, scale: 2 }),

  // User access fields
  username: varchar('username', { length: 50 }).unique(),
  passwordHash: varchar('password_hash', { length: 255 }),

  // Module permissions (flexible JSON for module access)
  permissions: jsonb('permissions').notNull().default({}),

  // Access codes
  accessCodes: jsonb('access_codes').notNull().default({}),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_employees_code').on(table.code),
  index('idx_employees_name').on(table.lastName, table.firstName),
  index('idx_employees_salesperson').on(table.isSalesperson),
  index('idx_employees_username').on(table.username),
]);

// Export types
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;
