import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, desc } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

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
}
