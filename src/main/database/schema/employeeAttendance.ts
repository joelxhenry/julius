import { pgTable, varchar, integer, serial, date, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { employees } from './employees';

// EMPLOYEE_ATTENDANCE table - merged employee_time + employee_log
export const employeeAttendance = pgTable('employee_attendance', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'set null' }),

  // Kept for legacy data without employee_id
  lastName: varchar('last_name', { length: 50 }),
  firstName: varchar('first_name', { length: 50 }),
  department: varchar('department', { length: 50 }),

  logDate: date('log_date').notNull(),
  logType: varchar('log_type', { length: 10 }).notNull(), // 'DAILY' or 'EVENT'

  // For DAILY records (from employee_time)
  inTime1: integer('in_time_1'),
  outTime1: integer('out_time_1'),
  inTime2: integer('in_time_2'),
  outTime2: integer('out_time_2'),
  inTime3: integer('in_time_3'),
  outTime3: integer('out_time_3'),

  // For EVENT records (from employee_log)
  activity: varchar('activity', { length: 10 }), // IN/OUT
  activityTime: integer('activity_time'),

  activityDesc: varchar('activity_desc', { length: 50 }), // NORMAL DAY, etc.
}, (table) => [
  index('idx_attendance_date').on(table.logDate),
  index('idx_attendance_employee').on(table.employeeId),
  index('idx_attendance_type').on(table.logType),
  index('idx_attendance_name').on(table.lastName, table.firstName),
  check('attendance_type_check', sql`${table.logType} IN ('DAILY', 'EVENT')`),
]);

// Export types
export type EmployeeAttendance = typeof employeeAttendance.$inferSelect;
export type InsertEmployeeAttendance = typeof employeeAttendance.$inferInsert;
