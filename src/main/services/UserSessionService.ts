import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, isNull, count, SQL } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface UserSessionQueryParams {
  employeeId?: number;
  since?: Date;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
}

/**
 * Records and queries application login/logout sessions (System User Tracking).
 */
export class UserSessionService extends BaseService<
  typeof schema.userSessions,
  schema.UserSession,
  schema.InsertUserSession
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.userSessions);
  }

  async recordLogin(data: {
    employeeId: number;
    employeeName: string;
    username: string;
  }): Promise<schema.UserSession> {
    return this.create(data);
  }

  async recordLogout(
    id: number,
    reason: 'manual' | 'idle_timeout' = 'manual'
  ): Promise<schema.UserSession | null> {
    const results = await this.db
      .update(schema.userSessions)
      .set({ logoutAt: new Date(), logoutReason: reason })
      .where(and(eq(schema.userSessions.id, id), isNull(schema.userSessions.logoutAt)))
      .returning();
    return results[0] || null;
  }

  async findPaginated(params: UserSessionQueryParams = {}): Promise<PaginatedResult<schema.UserSession>> {
    const { employeeId, since, activeOnly, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];
    if (employeeId) conditions.push(eq(schema.userSessions.employeeId, employeeId));
    if (since) conditions.push(gte(schema.userSessions.loginAt, since));
    if (activeOnly) conditions.push(isNull(schema.userSessions.logoutAt));

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.userSessions)
      .where(whereCondition);
    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.userSessions)
      .where(whereCondition)
      .orderBy(desc(schema.userSessions.loginAt))
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
}
