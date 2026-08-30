import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

/**
 * RBAC roles: named permission sets that employees are assigned to.
 */
export class RoleService extends BaseService<
  typeof schema.roles,
  schema.Role,
  schema.InsertRole
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.roles);
  }

  async findAllOrdered(): Promise<schema.Role[]> {
    return this.db.select().from(schema.roles).orderBy(desc(schema.roles.isSuperAdmin), schema.roles.name);
  }

  async findByName(name: string): Promise<schema.Role | null> {
    const results = await this.db
      .select()
      .from(schema.roles)
      .where(ilike(schema.roles.name, name.trim()))
      .limit(1);
    return results[0] || null;
  }

  /** How many employees are currently assigned to a role. */
  async countAssignedEmployees(roleId: number): Promise<number> {
    const rows = await this.db
      .select({ id: schema.employees.id })
      .from(schema.employees)
      .where(eq(schema.employees.roleId, roleId));
    return rows.length;
  }
}
