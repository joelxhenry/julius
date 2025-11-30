import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export interface InventoryTransactionQueryParams {
  sku?: string;
  activity?: string;
  startDate?: string;
  endDate?: string;
}

export class InventoryTransactionService extends BaseService<
  typeof schema.inventoryTransactions,
  schema.InventoryTransaction,
  schema.InsertInventoryTransaction
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.inventoryTransactions);
  }

  async findBySku(sku: string): Promise<schema.InventoryTransaction[]> {
    return this.db
      .select()
      .from(schema.inventoryTransactions)
      .where(eq(schema.inventoryTransactions.sku, sku))
      .orderBy(desc(schema.inventoryTransactions.activityDate));
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
