import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, ilike, desc, count, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface SupplierQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  activeOnly?: boolean;
}

export class SupplierService extends BaseService<
  typeof schema.suppliers,
  schema.Supplier,
  schema.InsertSupplier
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.suppliers);
  }

  async findPaginated(params: SupplierQueryParams = {}): Promise<PaginatedResult<schema.Supplier>> {
    const { page = 1, pageSize = 50, search, activeOnly } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.suppliers.company, searchTerm),
          ilike(schema.suppliers.contact1, searchTerm),
          ilike(schema.suppliers.contact2, searchTerm)
        )
      );
    }

    if (activeOnly) {
      conditions.push(eq(schema.suppliers.isActive, true));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.suppliers)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.suppliers)
      .where(whereCondition)
      .orderBy(desc(schema.suppliers.id))
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

  async findByCompany(company: string): Promise<schema.Supplier | null> {
    const results = await this.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.company, company))
      .limit(1);
    return results[0] || null;
  }

  async search(query: string): Promise<schema.Supplier[]> {
    const searchTerm = `%${query}%`;
    return this.db
      .select()
      .from(schema.suppliers)
      .where(
        or(
          like(schema.suppliers.company, searchTerm),
          like(schema.suppliers.contact1, searchTerm),
          like(schema.suppliers.contact2, searchTerm)
        )
      );
  }

  async searchForSelect(query: string, limit = 20): Promise<schema.Supplier[]> {
    const conditions = [];

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(schema.suppliers.company, searchTerm),
          ilike(schema.suppliers.contact1, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(schema.suppliers)
      .where(whereCondition)
      .orderBy(desc(schema.suppliers.id))
      .limit(limit);
  }

  async findBySupplierCode(supplierCode: string): Promise<schema.Supplier | null> {
    const results = await this.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.supplierCode, supplierCode))
      .limit(1);
    return results[0] || null;
  }

  async findActive(): Promise<schema.Supplier[]> {
    return this.db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.isActive, true))
      .orderBy(desc(schema.suppliers.id));
  }

  async activate(id: number): Promise<schema.Supplier | null> {
    const results = await this.db
      .update(schema.suppliers)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .returning();
    return results[0] || null;
  }

  async deactivate(id: number): Promise<schema.Supplier | null> {
    const results = await this.db
      .update(schema.suppliers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .returning();
    return results[0] || null;
  }
}
