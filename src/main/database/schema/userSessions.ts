import { pgTable, serial, integer, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { employees } from './employees';

// USER_SESSIONS table - System User Tracking: records each application
// login and the matching logout, so admins can review who signed in/out and when.
export const userSessions = pgTable('user_sessions', {
  id: serial('id').primaryKey(),

  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'set null' }),
  // Snapshot of the signed-in user, kept even if the employee record changes later
  employeeName: varchar('employee_name', { length: 120 }),
  username: varchar('username', { length: 50 }),

  loginAt: timestamp('login_at').notNull().defaultNow(),
  logoutAt: timestamp('logout_at'),
  // 'manual' | 'idle_timeout' — null while the session is still open
  logoutReason: varchar('logout_reason', { length: 20 }),
}, (table) => [
  index('idx_user_sessions_employee').on(table.employeeId),
  index('idx_user_sessions_login').on(table.loginAt),
]);

// Export types
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;
