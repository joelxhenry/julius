import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class ClientService extends BaseService<
  typeof schema.clients,
  schema.Client,
  schema.InsertClient
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.clients);
  }

  async findByLegacyId(legacyId: number): Promise<schema.Client | null> {
    const results = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.legacyId, legacyId))
      .limit(1);
    return results[0] || null;
  }

  async findByEmail(email: string): Promise<schema.Client | null> {
    const results = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.email, email))
      .limit(1);
    return results[0] || null;
  }

  async search(query: string): Promise<schema.Client[]> {
    return this.db
      .select()
      .from(schema.clients)
      .where(
        or(
          like(schema.clients.name, `%${query}%`),
          like(schema.clients.email, `%${query}%`),
          like(schema.clients.phone, `%${query}%`)
        )
      );
  }

  async updateCreditLimit(id: number, creditLimit: number): Promise<schema.Client | null> {
    return this.update(id, { creditLimit });
  }

  async updateDiscountRate(id: number, discountRate: number): Promise<schema.Client | null> {
    return this.update(id, { discountRate });
  }
}
