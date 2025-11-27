import { pgTable, varchar, integer, serial, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// AUDIT_LOG table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  referenceType: varchar('reference_type', { length: 100 }).notNull(),
  referenceId: integer('reference_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export types
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
