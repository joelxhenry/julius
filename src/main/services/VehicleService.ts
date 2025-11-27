import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';

export class VehicleModelService extends BaseService<
  typeof schema.vehicleModels,
  schema.VehicleModel,
  schema.InsertVehicleModel
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.vehicleModels);
  }

  async search(query: string): Promise<schema.VehicleModel[]> {
    return this.db
      .select()
      .from(schema.vehicleModels)
      .where(
        or(
          like(schema.vehicleModels.make, `%${query}%`),
          like(schema.vehicleModels.model, `%${query}%`)
        )
      );
  }

  async findByMakeAndModel(make: string, model: string): Promise<schema.VehicleModel | null> {
    const results = await this.db
      .select()
      .from(schema.vehicleModels)
      .where(
        or(
          eq(schema.vehicleModels.make, make),
          eq(schema.vehicleModels.model, model)
        )
      )
      .limit(1);
    return results[0] || null;
  }
}

export class PartModelService extends BaseService<
  typeof schema.partModels,
  schema.PartModel,
  schema.InsertPartModel
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.partModels);
  }

  async findByPart(partId: number): Promise<schema.PartModel[]> {
    return this.db
      .select()
      .from(schema.partModels)
      .where(eq(schema.partModels.partId, partId));
  }

  async findByVehicleModel(vehicleModelId: number): Promise<schema.PartModel[]> {
    return this.db
      .select()
      .from(schema.partModels)
      .where(eq(schema.partModels.vehicleModelId, vehicleModelId));
  }

  async bulkCreate(items: schema.InsertPartModel[]): Promise<schema.PartModel[]> {
    return this.db
      .insert(schema.partModels)
      .values(items)
      .returning();
  }
}
