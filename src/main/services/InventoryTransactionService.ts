import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, lte, count, ilike, or, sql, isNull } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

// Sentinel value used to scope a transaction query to the base inventory item
// only (variant_sku IS NULL), excluding its variants.
export const BASE_SKU_FILTER = '__base__';

export interface InventoryTransactionQueryParams {
  page?: number;
  pageSize?: number;
  sku?: string;
  activity?: string;
  startDate?: string;
  endDate?: string;
  // Optional variant scope:
  //   undefined       -> base item + all its variants
  //   BASE_SKU_FILTER -> base item only (variant_sku IS NULL)
  //   <variant sku>   -> that variant only
  variantSku?: string;
}

export class InventoryTransactionService extends BaseService<
  typeof schema.inventoryTransactions,
  schema.InventoryTransaction,
  schema.InsertInventoryTransaction
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.inventoryTransactions);
  }

  async findPaginated(params: InventoryTransactionQueryParams = {}): Promise<PaginatedResult<schema.InventoryTransaction>> {
    const { page = 1, pageSize = 50, sku, activity, startDate, endDate, variantSku } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (sku && sku.trim()) {
      conditions.push(eq(schema.inventoryTransactions.sku, sku.trim()));
    }

    if (variantSku === BASE_SKU_FILTER) {
      conditions.push(isNull(schema.inventoryTransactions.variantSku));
    } else if (variantSku && variantSku.trim()) {
      conditions.push(eq(schema.inventoryTransactions.variantSku, variantSku.trim()));
    }

    if (activity && activity !== 'all') {
      conditions.push(eq(schema.inventoryTransactions.activity, activity));
    }

    if (startDate) {
      conditions.push(gte(schema.inventoryTransactions.activityDate, startDate));
    }

    if (endDate) {
      conditions.push(lte(schema.inventoryTransactions.activityDate, endDate));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.inventoryTransactions)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(whereCondition)
      .orderBy(desc(schema.inventoryTransactions.activityDate), desc(schema.inventoryTransactions.id))
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

  async findBySku(sku: string): Promise<schema.InventoryTransaction[]> {
    return this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.sku, sku))
      .orderBy(desc(schema.inventoryTransactions.activityDate));
  }

  async findBySkuPaginated(sku: string, params: InventoryTransactionQueryParams = {}): Promise<PaginatedResult<schema.InventoryTransaction>> {
    return this.findPaginated({ ...params, sku });
  }

  async findByActivity(activity: string): Promise<schema.InventoryTransaction[]> {
    return this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.activity, activity))
      .orderBy(desc(schema.inventoryTransactions.activityDate));
  }

  async findByReference(reference: string): Promise<schema.InventoryTransaction[]> {
    return this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.reference, reference))
      .orderBy(desc(schema.inventoryTransactions.activityDate));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.InventoryTransaction[]> {
    return this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(
        and(
          gte(schema.inventoryTransactions.activityDate, startDate),
          lte(schema.inventoryTransactions.activityDate, endDate)
        )
      )
      .orderBy(desc(schema.inventoryTransactions.activityDate));
  }

  async findByDateRangePaginated(startDate: string, endDate: string, params: InventoryTransactionQueryParams = {}): Promise<PaginatedResult<schema.InventoryTransaction>> {
    return this.findPaginated({ ...params, startDate, endDate });
  }

  async recordTransaction(
    sku: string,
    activity: string,
    quantity: number,
    reference?: string
  ): Promise<schema.InventoryTransaction> {
    return this.create({
      sku,
      activity,
      quantity,
      reference: reference || null,
      activityDate: new Date().toISOString().split('T')[0],
    });
  }
}
