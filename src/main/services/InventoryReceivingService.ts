import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc, count } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface ReceivingQueryParams {
  page?: number;
  pageSize?: number;
}

export class InventoryReceivingService extends BaseService<
  typeof schema.inventoryReceiving,
  schema.InventoryReceiving,
  schema.InsertInventoryReceiving
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.inventoryReceiving);
  }

  async findBySku(sku: string): Promise<schema.InventoryReceiving[]> {
    return this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.sku, sku))
      .orderBy(desc(schema.inventoryReceiving.receivingDate));
  }

  async findBySupplier(supplier: string): Promise<schema.InventoryReceiving[]> {
    return this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.supplier, supplier))
      .orderBy(desc(schema.inventoryReceiving.receivingDate));
  }

  async findByReference(reference: string): Promise<schema.InventoryReceiving[]> {
    return this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.reference, reference));
  }

  async getLatestForSku(sku: string): Promise<schema.InventoryReceiving | null> {
    const results = await this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.sku, sku))
      .orderBy(desc(schema.inventoryReceiving.receivingDate))
      .limit(1);
    return results[0] || null;
  }

  async findBySkuPaginated(
    sku: string,
    params: ReceivingQueryParams = {}
  ): Promise<PaginatedResult<schema.InventoryReceiving>> {
    const { page = 1, pageSize = 10 } = params;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.sku, sku));

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.sku, sku))
      .orderBy(desc(schema.inventoryReceiving.receivingDate))
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

  async findBySupplierIdPaginated(
    supplierId: number,
    params: ReceivingQueryParams = {}
  ): Promise<PaginatedResult<schema.InventoryReceiving>> {
    const { page = 1, pageSize = 10 } = params;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.supplierId, supplierId));

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.supplierId, supplierId))
      .orderBy(desc(schema.inventoryReceiving.receivingDate))
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
}
