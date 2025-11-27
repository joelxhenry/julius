import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class EmployeeService extends BaseService<
  typeof schema.employees,
  schema.Employee,
  schema.InsertEmployee
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.employees);
  }

  async findByUsername(username: string): Promise<schema.Employee | null> {
    const results = await this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.username, username))
      .limit(1);
    return results[0] || null;
  }

  async findByRole(roleId: number): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.roleId, roleId));
  }

  async findActive(): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.endDate, null as any));
  }

  async search(query: string): Promise<schema.Employee[]> {
    return this.db
      .select()
      .from(schema.employees)
      .where(
        or(
          like(schema.employees.firstName, `%${query}%`),
          like(schema.employees.lastName, `%${query}%`),
          like(schema.employees.username, `%${query}%`)
        )
      );
  }

  async updatePin(id: number, pinHash: string, usingDefaultPin: boolean = false): Promise<schema.Employee | null> {
    return this.update(id, { pinHash, usingDefaultPin });
  }

  async terminateEmployee(id: number, endDate: string): Promise<schema.Employee | null> {
    return this.update(id, { endDate });
  }
}
