import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, desc, count } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface CategoryQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryType?: 'account' | 'inventory';
}

export class CategoryService extends BaseService<
  typeof schema.categories,
  schema.Category,
  schema.InsertCategory
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.categories);
  }

  async findPaginated(params: CategoryQueryParams = {}): Promise<PaginatedResult<schema.Category>> {
    const { page = 1, pageSize = 50, search, categoryType } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(ilike(schema.categories.category, searchTerm));
    }

    if (categoryType) {
      conditions.push(eq(schema.categories.categoryType, categoryType));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.categories)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.categories)
      .where(whereCondition)
      .orderBy(desc(schema.categories.id))
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

  async findByType(categoryType: 'account' | 'inventory'): Promise<schema.Category[]> {
    return this.db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.categoryType, categoryType));
  }

  async findInventoryCategories(): Promise<schema.Category[]> {
    return this.findByType('inventory');
  }

  async findAccountCategories(): Promise<schema.Category[]> {
    return this.findByType('account');
  }
}
