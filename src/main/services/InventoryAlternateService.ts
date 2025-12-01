import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, or, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class InventoryAlternateService extends BaseService<
  typeof schema.inventoryAlternates,
  schema.InventoryAlternate,
  schema.InsertInventoryAlternate
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.inventoryAlternates);
  }

  async findByPartNo(partNo: string): Promise<schema.InventoryAlternate[]> {
    return this.db
      .select()
      .from(schema.inventoryAlternates)
      .where(eq(schema.inventoryAlternates.partNo, partNo));
  }

  async findByAlternateNo(alternateNo: string): Promise<schema.InventoryAlternate[]> {
    return this.db
      .select()
      .from(schema.inventoryAlternates)
      .where(eq(schema.inventoryAlternates.alternateNo, alternateNo));
  }

  async findAllAlternates(partNo: string): Promise<schema.InventoryAlternate[]> {
    // Find all alternates where this part number appears in either column
    return this.db
      .select()
      .from(schema.inventoryAlternates)
      .where(
        or(
          eq(schema.inventoryAlternates.partNo, partNo),
          eq(schema.inventoryAlternates.alternateNo, partNo)
        )
      );
  }

  async findBySupplier(supplier: string): Promise<schema.InventoryAlternate[]> {
    return this.db
      .select()
      .from(schema.inventoryAlternates)
      .where(eq(schema.inventoryAlternates.supplier, supplier));
  }

  async deleteAlternate(partNo: string, alternateNo: string): Promise<boolean> {
    // Delete the alternate relation in either direction
    const result = await this.db
      .delete(schema.inventoryAlternates)
      .where(
        or(
          and(
            eq(schema.inventoryAlternates.partNo, partNo),
            eq(schema.inventoryAlternates.alternateNo, alternateNo)
          ),
          and(
            eq(schema.inventoryAlternates.partNo, alternateNo),
            eq(schema.inventoryAlternates.alternateNo, partNo)
          )
        )
      )
      .returning();
    return result.length > 0;
  }

  async createAlternate(partNo: string, alternateNo: string, supplier?: string): Promise<schema.InventoryAlternate> {
    return this.create({
      partNo,
      alternateNo,
      supplier: supplier || null,
    });
  }
}
