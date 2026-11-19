import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, SQL } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface ErrorLogQueryParams {
  page?: number;
  pageSize?: number;
  resolved?: boolean;
  source?: string;
}

/**
 * Persists and queries the global error log (see schema/errorLogs.ts).
 *
 * Holds a process-wide static instance so the error-sanitizing helpers
 * (errorSanitizer.ts) and BaseController.handleError can log errors without
 * every controller/service having to be threaded with an ErrorLogService
 * dependency just for this cross-cutting concern.
 */
export class ErrorLogService extends BaseService<
  typeof schema.errorLogs,
  schema.ErrorLog,
  schema.InsertErrorLog
> {
  private static instance: ErrorLogService | null = null;

  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.errorLogs);
  }

  static setInstance(svc: ErrorLogService) {
    ErrorLogService.instance = svc;
  }

  static getInstance(): ErrorLogService | null {
    return ErrorLogService.instance;
  }

  async log(
    entry: Omit<schema.InsertErrorLog, 'id' | 'createdAt' | 'resolved' | 'resolvedAt' | 'resolvedBy'>
  ): Promise<schema.ErrorLog> {
    return this.create(entry as schema.InsertErrorLog);
  }

  async findPaginated(params: ErrorLogQueryParams = {}): Promise<PaginatedResult<schema.ErrorLog>> {
    const { resolved, source, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];
    if (resolved !== undefined) conditions.push(eq(schema.errorLogs.resolved, resolved));
    if (source) conditions.push(eq(schema.errorLogs.source, source));
    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.errorLogs)
      .where(whereCondition);
    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.errorLogs)
      .where(whereCondition)
      .orderBy(desc(schema.errorLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async markResolved(id: number, resolvedBy: string): Promise<schema.ErrorLog | null> {
    const results = await this.db
      .update(schema.errorLogs)
      .set({ resolved: true, resolvedAt: new Date(), resolvedBy })
      .where(eq(schema.errorLogs.id, id))
      .returning();
    return results[0] || null;
  }
}
