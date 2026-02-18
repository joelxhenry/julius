import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, asc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface AttendanceQueryParams {
  page?: number;
  pageSize?: number;
  employeeId?: number;
  logType?: 'DAILY' | 'EVENT';
  startDate?: string;
  endDate?: string;
}

export class EmployeeAttendanceService extends BaseService<
  typeof schema.employeeAttendance,
  schema.EmployeeAttendance,
  schema.InsertEmployeeAttendance
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.employeeAttendance);
  }

  async findPaginated(params: AttendanceQueryParams = {}): Promise<PaginatedResult<schema.EmployeeAttendance>> {
    const { page = 1, pageSize = 50, employeeId, logType, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (employeeId) {
      conditions.push(eq(schema.employeeAttendance.employeeId, employeeId));
    }

    if (logType) {
      conditions.push(eq(schema.employeeAttendance.logType, logType));
    }

    if (startDate) {
      conditions.push(gte(schema.employeeAttendance.logDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.employeeAttendance.logDate, endDate));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.employeeAttendance)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.employeeAttendance)
      .where(whereCondition)
      .orderBy(desc(schema.employeeAttendance.logDate))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findByEmployee(employeeId: number): Promise<schema.EmployeeAttendance[]> {
    return this.db
      .select()
      .from(schema.employeeAttendance)
      .where(eq(schema.employeeAttendance.employeeId, employeeId))
      .orderBy(desc(schema.employeeAttendance.logDate));
  }

  async findByDate(logDate: string): Promise<schema.EmployeeAttendance[]> {
    return this.db
      .select()
      .from(schema.employeeAttendance)
      .where(eq(schema.employeeAttendance.logDate, logDate));
  }

  async findByDateRange(startDate: string, endDate: string, employeeId?: number): Promise<schema.EmployeeAttendance[]> {
    const conditions = [
      gte(schema.employeeAttendance.logDate, startDate),
      lte(schema.employeeAttendance.logDate, endDate),
    ];
    if (employeeId !== undefined) {
      conditions.push(eq(schema.employeeAttendance.employeeId, employeeId));
    }
    return this.db
      .select()
      .from(schema.employeeAttendance)
      .where(and(...conditions))
      .orderBy(desc(schema.employeeAttendance.logDate));
  }

  /** Returns the active (open) clock-in record for today, or null if not clocked in. */
  async findActiveClockIn(employeeId: number): Promise<schema.EmployeeAttendance | null> {
    const today = new Date().toISOString().split('T')[0];
    const results = await this.db
      .select()
      .from(schema.employeeAttendance)
      .where(
        and(
          eq(schema.employeeAttendance.employeeId, employeeId),
          eq(schema.employeeAttendance.logType, 'EVENT'),
          eq(schema.employeeAttendance.logDate, today)
        )
      )
      .orderBy(desc(schema.employeeAttendance.activityTime))
      .limit(1);

    const latest = results[0];
    return latest && latest.activity === 'IN' ? latest : null;
  }

  /** Clock in an employee. Throws if already clocked in. */
  async clockIn(employeeId: number, notes?: string): Promise<schema.EmployeeAttendance> {
    const active = await this.findActiveClockIn(employeeId);
    if (active) {
      throw new Error('Employee is already clocked in');
    }
    const today = new Date().toISOString().split('T')[0];
    return this.create({
      employeeId,
      logDate: today,
      logType: 'EVENT',
      activity: 'IN',
      activityTime: Math.floor(Date.now() / 1000),
      activityDesc: notes || 'NORMAL DAY',
    });
  }

  /** Clock out an employee. Returns null if not clocked in. */
  async clockOut(employeeId: number, notes?: string): Promise<schema.EmployeeAttendance | null> {
    const active = await this.findActiveClockIn(employeeId);
    if (!active) {
      return null;
    }
    const today = new Date().toISOString().split('T')[0];
    return this.create({
      employeeId,
      logDate: today,
      logType: 'EVENT',
      activity: 'OUT',
      activityTime: Math.floor(Date.now() / 1000),
      activityDesc: notes || 'NORMAL DAY',
    });
  }

  /** Calculate total hours worked by an employee in a date range. */
  async getTotalHours(employeeId: number, startDate: string, endDate: string): Promise<number> {
    const events = await this.db
      .select()
      .from(schema.employeeAttendance)
      .where(
        and(
          eq(schema.employeeAttendance.employeeId, employeeId),
          eq(schema.employeeAttendance.logType, 'EVENT'),
          gte(schema.employeeAttendance.logDate, startDate),
          lte(schema.employeeAttendance.logDate, endDate)
        )
      )
      .orderBy(asc(schema.employeeAttendance.activityTime));

    let totalSeconds = 0;
    let pendingIn: number | null = null;

    for (const event of events) {
      if (event.activity === 'IN' && event.activityTime !== null) {
        pendingIn = event.activityTime;
      } else if (event.activity === 'OUT' && event.activityTime !== null && pendingIn !== null) {
        totalSeconds += event.activityTime - pendingIn;
        pendingIn = null;
      }
    }

    return totalSeconds / 3600;
  }

  async recordClockIn(employeeId: number, time: number): Promise<schema.EmployeeAttendance> {
    const today = new Date().toISOString().split('T')[0];
    return this.create({
      employeeId,
      logDate: today,
      logType: 'EVENT',
      activity: 'IN',
      activityTime: time,
    });
  }

  async recordClockOut(employeeId: number, time: number): Promise<schema.EmployeeAttendance> {
    const today = new Date().toISOString().split('T')[0];
    return this.create({
      employeeId,
      logDate: today,
      logType: 'EVENT',
      activity: 'OUT',
      activityTime: time,
    });
  }
}
