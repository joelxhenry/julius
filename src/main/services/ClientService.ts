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
          ilike(schema.clients.clientName, searchTerm),
          ilike(schema.clients.clNumber, searchTerm),
          ilike(schema.clients.phone, searchTerm),
          ilike(schema.clients.contact, searchTerm)
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

  async findByClNumber(clNumber: string): Promise<schema.Client | null> {
    const results = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.clNumber, clNumber))
      .limit(1);
    return results[0] || null;
  }

  async findByName(clientName: string): Promise<schema.Client | null> {
    const results = await this.db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.clientName, clientName))
      .limit(1);
    return results[0] || null;
  }

  async search(query: string): Promise<schema.Client[]> {
    const searchTerm = `%${query}%`;
    return this.db
      .select()
      .from(schema.clients)
      .where(
        or(
          like(schema.clients.clientName, searchTerm),
          like(schema.clients.clNumber, searchTerm),
          like(schema.clients.phone, searchTerm),
          like(schema.clients.contact, searchTerm)
        )
      );
  }

  async searchForSelect(query: string, limit = 20): Promise<schema.Client[]> {
    if (!query || !query.trim()) {
      return this.db
        .select()
        .from(schema.clients)
        .orderBy(desc(schema.clients.id))
        .limit(limit);
    }

    const searchTerm = `%${query.trim()}%`;
    return this.db
      .select()
      .from(schema.clients)
      .where(
        or(
          ilike(schema.clients.clientName, searchTerm),
          ilike(schema.clients.clNumber, searchTerm),
          ilike(schema.clients.phone, searchTerm),
          ilike(schema.clients.contact, searchTerm)
        )
      )
      .orderBy(desc(schema.clients.id))
      .limit(limit);
  }

  async updateCreditLimit(id: number, creditLimit: string): Promise<schema.Client | null> {
    return this.update(id, { creditLimit, updatedAt: new Date() });
  }

  async updateDiscountPct(id: number, discountPct: string): Promise<schema.Client | null> {
    return this.update(id, { discountPct, updatedAt: new Date() });
  }
}
