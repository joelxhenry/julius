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
  clientId?: number;
  includeArchived?: boolean;
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
    const { page = 1, pageSize = 50, search, status, clientId, includeArchived = false } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (!includeArchived) {
      conditions.push(eq(schema.quotations.isArchived, false));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.quotations.quoteNum, searchTerm),
          ilike(schema.quotations.reference, searchTerm),
          ilike(schema.quotations.clientName, searchTerm)
        )
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.quotations.status, status));
    }

    if (clientId) {
      conditions.push(eq(schema.quotations.clientId, clientId));
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

  async findByQuoteNum(quoteNum: string): Promise<schema.Quotation | null> {
    const results = await this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.quoteNum, quoteNum))
      .limit(1);
    return results[0] || null;
  }

  async findByClient(clientId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.clientId, clientId))
      .orderBy(desc(schema.quotations.createdAt));
  }

  async findBySalesperson(salespersonId: number): Promise<schema.Quotation[]> {
    return this.db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.salespersonId, salespersonId))
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
          gte(schema.quotations.quoteDate, startDate),
          lte(schema.quotations.quoteDate, endDate)
        )
      )
      .orderBy(desc(schema.quotations.quoteDate));
  }

  async convertToInvoice(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'converted' });
  }

  async expire(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { status: 'expired' });
  }

  async archive(id: number): Promise<schema.Quotation | null> {
    return this.update(id, { isArchived: true });
  }
}
