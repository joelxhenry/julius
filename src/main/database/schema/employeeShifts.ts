import { pgTable, integer, serial, timestamp, date, varchar, index } from 'drizzle-orm/pg-core';
import { employees } from './employees';

// EMPLOYEE_SHIFTS table - one row per shift session (clock-in/clock-out pair)
export const employeeShifts = pgTable('employee_shifts', {
  id: serial('id').primaryKey(),
  employeeId: integer('employee_id')
    .references(() => employees.id, { onDelete: 'set null' }),

  // The calendar date of the shift (for easy date-range queries)
  shiftDate: date('shift_date').notNull(),

  // Timestamptz for accuracy - clock_out_at is null while the shift is open
  clockInAt: timestamp('clock_in_at', { withTimezone: true }).notNull(),
  clockOutAt: timestamp('clock_out_at', { withTimezone: true }),

  notes: varchar('notes', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_shifts_employee').on(table.employeeId),
  index('idx_shifts_date').on(table.shiftDate),
  index('idx_shifts_employee_date').on(table.employeeId, table.shiftDate),
]);

export type EmployeeShift = typeof employeeShifts.$inferSelect;
export type InsertEmployeeShift = typeof employeeShifts.$inferInsert;
