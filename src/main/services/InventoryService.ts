import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, and, ilike, desc, asc, count } from 'drizzle-orm';
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

/**
 * Unified search result type for inventory and variants
 */
export interface UnifiedSearchResult {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  isTaxable: boolean;
  isVariant: boolean;
  parentSku: string | null;
  variantName: string | null;
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

  async getVariantsBySku(parentSku: string): Promise<schema.Variant[]> {
    return this.db
      .select()
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isActive, true)))
      .orderBy(asc(schema.variants.variantName));
  }

  async hasVariants(parentSku: string): Promise<boolean> {
    const variants = await this.db
      .select({ count: count() })
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isActive, true)));

    return Number(variants[0]?.count ?? 0) > 0;
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

  /**
   * Search inventory and variants together, returning a unified result
   * Useful for invoice line item selection
   */
  async searchWithVariants(query: string, limit = 20): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = [];

    if (!query || !query.trim()) {
      return results;
    }

    const searchTerm = `%${query.trim()}%`;

    // Search inventory items
    const inventoryItems = await this.db
      .select()
      .from(schema.inventory)
      .where(
        or(
          ilike(schema.inventory.sku, searchTerm),
          ilike(schema.inventory.description1, searchTerm),
          ilike(schema.inventory.model, searchTerm)
        )
      )
      .orderBy(desc(schema.inventory.id))
      .limit(limit);

    // Add inventory items to results
    for (const item of inventoryItems) {
      results.push({
        id: item.id,
        sku: item.sku,
        description1: item.description1,
        description2: item.description2,
        price: item.price,
        cost: item.cost,
        quantity: item.quantity,
        isTaxable: item.isTaxable,
        isVariant: false,
        parentSku: null,
        variantName: null,
      });
    }

    // Search variants
    const variantItems = await this.db
      .select({
        variant: schema.variants,
        parent: schema.inventory,
      })
      .from(schema.variants)
      .leftJoin(schema.inventory, eq(schema.variants.parentSku, schema.inventory.sku))
      .where(
        and(
          eq(schema.variants.isActive, true),
          or(
            ilike(schema.variants.variantSku, searchTerm),
            ilike(schema.variants.variantName, searchTerm),
            ilike(schema.variants.description, searchTerm)
          )
        )
      )
      .orderBy(desc(schema.variants.id))
      .limit(limit);

    // Add variant items to results
    for (const { variant, parent } of variantItems) {
      results.push({
        id: variant.id,
        sku: variant.variantSku,
        description1: variant.variantName || variant.description,
        description2: parent?.description1 || null,
        price: variant.price || parent?.price || '0',
        cost: variant.cost || parent?.cost || '0',
        quantity: variant.quantity,
        isTaxable: parent?.isTaxable ?? true,
        isVariant: true,
        parentSku: variant.parentSku,
        variantName: variant.variantName,
      });
    }

    // Sort by relevance (exact SKU matches first) and limit
    results.sort((a, b) => {
      const aExact = a.sku.toLowerCase() === query.toLowerCase() ? 0 : 1;
      const bExact = b.sku.toLowerCase() === query.toLowerCase() ? 0 : 1;
      return aExact - bExact;
    });

    return results.slice(0, limit);
  }
}
