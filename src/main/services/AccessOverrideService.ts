import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, SQL } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export interface AccessOverrideQueryParams {
  permissionCode?: string;
  requestedById?: number;
  grantedById?: number;
  since?: Date;
  limit?: number;
}

/**
 * Records and queries one-time permission overrides (temporary elevations where
 * an authorised user grants a logged-in user access to a single action).
 */
export class AccessOverrideService extends BaseService<
  typeof schema.accessOverrides,
  schema.AccessOverride,
  schema.InsertAccessOverride
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.accessOverrides);
  }

  async record(data: schema.InsertAccessOverride): Promise<schema.AccessOverride> {
    return this.create(data);
  }

  async findRecent(params: AccessOverrideQueryParams = {}): Promise<schema.AccessOverride[]> {
    const { permissionCode, requestedById, grantedById, since, limit = 100 } = params;

    const conditions: SQL[] = [];
    if (permissionCode) conditions.push(eq(schema.accessOverrides.permissionCode, permissionCode));
    if (requestedById) conditions.push(eq(schema.accessOverrides.requestedById, requestedById));
    if (grantedById) conditions.push(eq(schema.accessOverrides.grantedById, grantedById));
    if (since) conditions.push(gte(schema.accessOverrides.createdAt, since));

    const query = this.db
      .select()
      .from(schema.accessOverrides)
      .orderBy(desc(schema.accessOverrides.createdAt))
      .limit(limit);

    if (conditions.length > 0) {
      return query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }
    return query;
  }
}
