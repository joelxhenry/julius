import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, and, ilike, desc, count } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface InventoryQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  location?: string;
}

export class InventoryService extends BaseService<
  typeof schema.inventory,
  schema.Inventory,
  schema.InsertInventory
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.inventory);
  }

  async findPaginated(params: InventoryQueryParams = {}): Promise<PaginatedResult<schema.Inventory>> {
    const { page = 1, pageSize = 50, search, category, location } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.inventory.sku, searchTerm),
          ilike(schema.inventory.description1, searchTerm),
          ilike(schema.inventory.description2, searchTerm),
          ilike(schema.inventory.model, searchTerm),
          ilike(schema.inventory.category, searchTerm),
          ilike(schema.inventory.location, searchTerm)
        )
      );
    }

    if (category && category !== 'all') {
      conditions.push(eq(schema.inventory.category, category));
    }

    if (location && location !== 'all') {
      conditions.push(eq(schema.inventory.location, location));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.inventory)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.inventory)
      .where(whereCondition)
      .orderBy(desc(schema.inventory.id))
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

  async findBySku(sku: string): Promise<schema.Inventory | null> {
    const results = await this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.sku, sku))
      .limit(1);
    return results[0] || null;
  }

  async findByCategory(category: string): Promise<schema.Inventory[]> {
    return this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.category, category));
  }

  async findByLocation(location: string): Promise<schema.Inventory[]> {
    return this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.location, location));
  }

  async search(query: string): Promise<schema.Inventory[]> {
    const searchTerm = `%${query}%`;
    return this.db
      .select()
      .from(schema.inventory)
      .where(
        or(
          like(schema.inventory.sku, searchTerm),
          like(schema.inventory.description1, searchTerm),
          like(schema.inventory.description2, searchTerm),
          like(schema.inventory.model, searchTerm)
        )
      );
  }

  async searchForSelect(query: string, limit = 20): Promise<schema.Inventory[]> {
    const conditions = [];

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(schema.inventory.sku, searchTerm),
          ilike(schema.inventory.description1, searchTerm),
          ilike(schema.inventory.model, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(schema.inventory)
      .where(whereCondition)
      .orderBy(desc(schema.inventory.id))
      .limit(limit);
  }

  async updateQuantity(sku: string, quantityChange: number): Promise<schema.Inventory | null> {
    const item = await this.findBySku(sku);
    if (!item) return null;

    const results = await this.db
      .update(schema.inventory)
      .set({ quantity: item.quantity + quantityChange, updatedAt: new Date() })
      .where(eq(schema.inventory.sku, sku))
      .returning();
    return results[0] || null;
  }

  async setQuantity(sku: string, quantity: number): Promise<schema.Inventory | null> {
    const results = await this.db
      .update(schema.inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(schema.inventory.sku, sku))
      .returning();
    return results[0] || null;
  }

  async updatePrice(sku: string, price: string): Promise<schema.Inventory | null> {
    const results = await this.db
      .update(schema.inventory)
      .set({ price, updatedAt: new Date() })
      .where(eq(schema.inventory.sku, sku))
      .returning();
    return results[0] || null;
  }

  async updateStock(id: number, quantity: number): Promise<schema.Inventory | null> {
    const results = await this.db
      .update(schema.inventory)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(schema.inventory.id, id))
      .returning();
    return results[0] || null;
  }

  async findLowStock(): Promise<schema.Inventory[]> {
    // Find items where quantity <= minLevel
    const results = await this.db
      .select()
      .from(schema.inventory);

    // Filter in JS since Drizzle doesn't support column comparisons easily
    return results.filter(item => item.quantity <= item.minLevel);
  }
}
