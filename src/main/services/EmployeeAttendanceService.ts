import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count } from 'drizzle-orm';
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

  async findByDateRange(startDate: string, endDate: string): Promise<schema.EmployeeAttendance[]> {
    return this.db
      .select()
      .from(schema.employeeAttendance)
      .where(
        and(
          gte(schema.employeeAttendance.logDate, startDate),
          lte(schema.employeeAttendance.logDate, endDate)
        )
      )
      .orderBy(desc(schema.employeeAttendance.logDate));
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
