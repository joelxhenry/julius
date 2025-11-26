import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { employees } from './employees';

// AUDIT_LOG table
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  referenceType: text('reference_type').notNull(),
  referenceId: integer('reference_id').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Export types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
