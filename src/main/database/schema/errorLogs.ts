import { pgTable, serial, integer, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { employees } from './employees';

// ERROR_LOGS table - Global error log: every error shown to a user (sanitized)
// or caught unexpectedly anywhere in the app is recorded here with full
// technical detail, so a developer can review and resolve it from Settings.
export const errorLogs = pgTable('error_logs', {
  id: serial('id').primaryKey(),

  source: varchar('source', { length: 20 }).notNull(), // 'ipc' | 'main' | 'renderer'
  context: varchar('context', { length: 150 }), // IPC channel / controller / component name
  severity: varchar('severity', { length: 10 }).notNull().default('error'), // 'critical' | 'error' | 'warning'

  userMessage: text('user_message').notNull(), // sanitized message shown to the user
  technicalMessage: text('technical_message').notNull(), // raw message (+ cause) for developers
  stack: text('stack'),
  errorCode: varchar('error_code', { length: 20 }), // e.g. Postgres error code '23505'

  employeeId: integer('employee_id').references(() => employees.id, { onDelete: 'set null' }),
  // Snapshot of who was signed in when it happened, kept even if the employee record changes later
  employeeName: varchar('employee_name', { length: 120 }),

  resolved: boolean('resolved').notNull().default(false),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 120 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('idx_error_logs_created').on(table.createdAt),
  index('idx_error_logs_resolved').on(table.resolved),
  index('idx_error_logs_severity').on(table.severity),
]);

// Export types
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = typeof errorLogs.$inferInsert;
