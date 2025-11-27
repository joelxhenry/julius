import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class UserService extends BaseService<
  typeof schema.users,
  schema.User,
  schema.InsertUser
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.users);
  }

  async findByUsername(username: string): Promise<schema.User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);
    return results[0] || null;
  }

  async findByRole(roleId: number): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.roleId, roleId));
  }

  async findActive(): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.active, true));
  }

  async search(query: string): Promise<schema.User[]> {
    return this.db
      .select()
      .from(schema.users)
      .where(
        or(
          like(schema.users.firstName, `%${query}%`),
          like(schema.users.lastName, `%${query}%`),
          like(schema.users.username, `%${query}%`)
        )
      );
  }

  async updatePin(id: number, pinHash: string, usingDefaultPin: boolean = false): Promise<schema.User | null> {
    return this.update(id, { pinHash, usingDefaultPin });
  }

  async deactivateUser(id: number, endDate: string): Promise<schema.User | null> {
    return this.update(id, { endDate, active: false });
  }
}
