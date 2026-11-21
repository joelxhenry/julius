import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, or, eq, ilike, gte, lte, desc, count } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface BusinessExpenseQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  isTaxDeductible?: boolean;
  startDate?: string;
  endDate?: string;
}

export class BusinessExpenseService extends BaseService<
  typeof schema.businessExpenses,
  schema.BusinessExpense,
  schema.InsertBusinessExpense
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.businessExpenses);
  }

  async findPaginated(params: BusinessExpenseQueryParams = {}): Promise<PaginatedResult<schema.BusinessExpense>> {
    const { page = 1, pageSize = 50, search, category, isTaxDeductible, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.businessExpenses.payee, searchTerm),
          ilike(schema.businessExpenses.description, searchTerm),
        ),
      );
    }

    if (category) {
      conditions.push(eq(schema.businessExpenses.category, category));
    }

    if (isTaxDeductible !== undefined) {
      conditions.push(eq(schema.businessExpenses.isTaxDeductible, isTaxDeductible));
    }

    if (startDate) conditions.push(gte(schema.businessExpenses.expenseDate, startDate));
    if (endDate) conditions.push(lte(schema.businessExpenses.expenseDate, endDate));

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.businessExpenses)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.businessExpenses)
      .where(whereCondition)
      .orderBy(desc(schema.businessExpenses.expenseDate), desc(schema.businessExpenses.id))
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

  async updateExpense(id: number, data: Partial<schema.InsertBusinessExpense>): Promise<schema.BusinessExpense | null> {
    return this.update(id, { ...data, updatedAt: new Date() });
  }
}
