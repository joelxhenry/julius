import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, isNull, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class EmployeeShiftsService extends BaseService<
  typeof schema.employeeShifts,
  schema.EmployeeShift,
  schema.InsertEmployeeShift
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.employeeShifts);
  }

  async findByEmployee(employeeId: number): Promise<schema.EmployeeShift[]> {
    return this.db
      .select()
      .from(schema.employeeShifts)
      .where(eq(schema.employeeShifts.employeeId, employeeId))
      .orderBy(desc(schema.employeeShifts.clockInAt));
  }

  async findByDateRange(
    startDate: string,
    endDate: string,
    employeeId?: number
  ): Promise<schema.EmployeeShift[]> {
    const conditions = [
      gte(schema.employeeShifts.shiftDate, startDate),
      lte(schema.employeeShifts.shiftDate, endDate),
    ];
    if (employeeId !== undefined) {
      conditions.push(eq(schema.employeeShifts.employeeId, employeeId));
    }
    return this.db
      .select()
      .from(schema.employeeShifts)
      .where(and(...conditions))
      .orderBy(desc(schema.employeeShifts.clockInAt));
  }

  /** Returns the currently open shift (no clock_out_at) for an employee, or null. */
  async findActiveShift(employeeId: number): Promise<schema.EmployeeShift | null> {
    const results = await this.db
      .select()
      .from(schema.employeeShifts)
      .where(
        and(
          eq(schema.employeeShifts.employeeId, employeeId),
          isNull(schema.employeeShifts.clockOutAt)
        )
      )
      .orderBy(desc(schema.employeeShifts.clockInAt))
      .limit(1);
    return results[0] ?? null;
  }

  /** Clock in: creates a new open shift. Throws if already clocked in. */
  async clockIn(employeeId: number, notes?: string): Promise<schema.EmployeeShift> {
    const active = await this.findActiveShift(employeeId);
    if (active) {
      throw new Error('Employee is already clocked in');
    }
    const now = new Date();
    const shiftDate = now.toISOString().split('T')[0];
    return this.create({
      employeeId,
      shiftDate,
      clockInAt: now,
      notes: notes ?? null,
    });
  }

  /** Clock out: closes the open shift. Returns null if not clocked in. */
  async clockOut(employeeId: number, notes?: string): Promise<schema.EmployeeShift | null> {
    const active = await this.findActiveShift(employeeId);
    if (!active) {
      return null;
    }
    const results = await this.db
      .update(schema.employeeShifts)
      .set({
        clockOutAt: new Date(),
        notes: notes ?? active.notes,
      })
      .where(eq(schema.employeeShifts.id, active.id))
      .returning();
    return results[0] ?? null;
  }

  /** Returns total hours worked in a date range as a decimal number. */
  async getTotalHours(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const shifts = await this.findByDateRange(startDate, endDate, employeeId);
    let totalMs = 0;
    for (const shift of shifts) {
      if (shift.clockInAt && shift.clockOutAt) {
        totalMs += new Date(shift.clockOutAt).getTime() - new Date(shift.clockInAt).getTime();
      }
    }
    return totalMs / 3_600_000;
  }
}
