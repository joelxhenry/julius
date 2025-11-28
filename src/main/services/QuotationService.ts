import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, or, ilike } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface QuotationQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export class QuotationService extends BaseService<
  typeof schema.quotations,
  schema.Quotation,
  schema.InsertQuotation
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.quotations);
  }

  async findPaginated(params: QuotationQueryParams = {}): Promise<PaginatedResult<schema.Quotation>> {
    const { page = 1, pageSize = 50, search, status } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.quotations.reference, searchTerm),
          ilike(schema.quotations.clientName, searchTerm)
        )
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.quotations.status, status));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.quotations)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.quotations)
      .where(whereCondition)
      .orderBy(desc(schema.quotations.createdAt))
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

  async findByClient(clientId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.clientId, clientId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByEmployee(employeeId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.employeeId, employeeId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByStatus(status: string): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.status, status))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(
        and(
          gte(schema.quotations.createdAt, startDate),
          lte(schema.quotations.createdAt, endDate)
        )
      )
      .orderBy(desc(schema.quotations.createdAt));
  }

  async convertToInvoice(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'converted' });
  }

  async expire(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'expired' });
  }
}

export class QuotationItemService extends BaseService<
  typeof schema.quotationItems,
  schema.QuotationItem,
  schema.InsertQuotationItem
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.quotationItems);
  }

  async findByQuotation(quotationId: number): Promise<schema.QuotationItem[]> {
    return this.db
      .select()
      .from(schema.quotationItems)
      .where(eq(schema.quotationItems.quotationId, quotationId));
  }

  async bulkCreate(items: schema.InsertQuotationItem[]): Promise<schema.QuotationItem[]> {
    return this.db
      .insert(schema.quotationItems)
      .values(items)
      .returning();
  }

  async deleteByQuotation(quotationId: number): Promise<boolean> {
    await this.db
      .delete(schema.quotationItems)
      .where(eq(schema.quotationItems.quotationId, quotationId));
    return true;
  }
}
