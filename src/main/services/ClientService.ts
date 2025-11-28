import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, ilike, desc, count, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface ClientQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export class ClientService extends BaseService<
  typeof schema.clients,
  schema.Client,
  schema.InsertClient
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.clients);
  }

  async findPaginated(params: ClientQueryParams = {}): Promise<PaginatedResult<schema.Client>> {
    const { page = 1, pageSize = 50, search } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.clients.name, searchTerm),
          ilike(schema.clients.email, searchTerm),
          ilike(schema.clients.phone, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.clients)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.clients)
      .where(whereCondition)
      .orderBy(desc(schema.clients.id))
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
