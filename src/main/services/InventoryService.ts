import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, and, ilike, desc, asc, count, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';
import { normalizeToArray } from '../../shared/utils/arrayFields';

export interface InventoryQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  model?: string;
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
  isBase?: boolean; // True if this is a base variant
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

  /**
   * Override create to auto-generate a base variant for new inventory items
   */
  async create(data: schema.InsertInventory): Promise<schema.Inventory> {
    // Create the inventory item
    const inventory = await super.create(data);

    // Auto-create base variant
    await this.createBaseVariant(inventory);

    return inventory;
  }

  /**
   * Override update to keep the base variant's location in sync. Location is
   * conceptually a per-variant property; the product-level column mirrors the
   * base variant so existing product-facing edits keep a single source of truth.
   */
  async update(id: number, data: Partial<schema.InsertInventory>): Promise<schema.Inventory | null> {
    const item = await super.update(id, data);
    if (item && data.location !== undefined) {
      await this.db
        .update(schema.variants)
        .set({ location: (data.location as string | null) ?? null, updatedAt: new Date() })
        .where(and(eq(schema.variants.parentSku, item.sku), eq(schema.variants.isBase, true)));
    }
    return item;
  }

  /**
   * Create a base variant for an inventory item
   */
  private async createBaseVariant(inventory: schema.Inventory): Promise<schema.Variant> {
    const results = await this.db.insert(schema.variants).values({
      parentSku: inventory.sku,
      variantSku: `${inventory.sku}`,
      variantName: inventory.description1 || 'Base',
      location: inventory.location || undefined,
      description: inventory.description2 || undefined,
      quantity: inventory.quantity,
      cost: inventory.cost,
      costCurrency: inventory.costCurrency,
      price: inventory.price,
      priceCurrency: inventory.priceCurrency,
      wholesalePrice: inventory.wholesalePrice || undefined,
      isActive: true,
      isBase: true,
      attributes: {},
    }).returning();
    return results[0];
  }

  /**
   * Get the base variant for an inventory item
   */
  async getBaseVariant(parentSku: string): Promise<schema.Variant | null> {
    const results = await this.db
      .select()
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isBase, true)))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Check if an inventory item has a base variant
   */
  async hasBaseVariant(parentSku: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isBase, true)));
    return Number(result[0]?.count ?? 0) > 0;
  }

  async findPaginated(params: InventoryQueryParams = {}): Promise<PaginatedResult<schema.Inventory>> {
    const { page = 1, pageSize = 50, search, category, model, location } = params;
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

    if (category && category.trim() && category !== 'all') {
      conditions.push(ilike(schema.inventory.category, `%${category.trim()}%`));
    }

    if (model && model.trim() && model !== 'all') {
      conditions.push(ilike(schema.inventory.model, `%${model.trim()}%`));
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
      .orderBy(asc(schema.inventory.sku))
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
   * Search variants only, returning a unified result
   * All inventory items have base variants, so this covers all products
   * Useful for invoice line item selection
   */
  async searchWithVariants(query: string, limit = 20): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = [];

    if (!query || !query.trim()) {
      return results;
    }

    const searchTerm = `%${query.trim()}%`;

    // Search variants only (includes base variants for all inventory items)
    // Also search by parent inventory fields (sku, description1, model)
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
            ilike(schema.variants.description, searchTerm),
            ilike(schema.variants.parentSku, searchTerm),
            ilike(schema.inventory.description1, searchTerm),
            ilike(schema.inventory.model, searchTerm)
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
        isBase: variant.isBase,
        parentSku: variant.parentSku,
        variantName: variant.variantName,
      });
    }

    // Sort by relevance (exact SKU matches first, then base variants before non-base)
    results.sort((a, b) => {
      const aExact = a.sku.toLowerCase() === query.toLowerCase() ? 0 : 1;
      const bExact = b.sku.toLowerCase() === query.toLowerCase() ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      // Base variants come before non-base variants
      const aBase = a.isBase ? 0 : 1;
      const bBase = b.isBase ? 0 : 1;
      return aBase - bBase;
    });

    return results.slice(0, limit);
  }

  /**
   * Get distinct categories across all inventory items
   * Handles both legacy single values and JSON array values
   * @param search - Optional search query to filter categories
   * @param limit - Maximum number of results to return (default 20)
   */
  async getDistinctCategories(search?: string, limit = 20): Promise<string[]> {
    const results = await this.db
      .select({ category: schema.inventory.category })
      .from(schema.inventory)
      .where(sql`${schema.inventory.category} IS NOT NULL AND ${schema.inventory.category} != ''`);

    // Flatten all categories from JSON arrays and legacy strings
    const allCategories = new Set<string>();
    for (const row of results) {
      const cats = normalizeToArray(row.category);
      cats.forEach((c) => allCategories.add(c));
    }

    let sorted = Array.from(allCategories).sort();

    // Filter by search if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      sorted = sorted.filter((c) => c.toLowerCase().includes(searchLower));
    }

    return sorted.slice(0, limit);
  }

  /**
   * Get distinct models across all inventory items
   * Handles both legacy single values and JSON array values
   * @param search - Optional search query to filter models
   * @param limit - Maximum number of results to return (default 20)
   */
  async getDistinctModels(search?: string, limit = 20): Promise<string[]> {
    const results = await this.db
      .select({ model: schema.inventory.model })
      .from(schema.inventory)
      .where(sql`${schema.inventory.model} IS NOT NULL AND ${schema.inventory.model} != ''`);

    // Flatten all models from JSON arrays and legacy strings
    const allModels = new Set<string>();
    for (const row of results) {
      const models = normalizeToArray(row.model);
      models.forEach((m) => allModels.add(m));
    }

    let sorted = Array.from(allModels).sort();

    // Filter by search if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      sorted = sorted.filter((m) => m.toLowerCase().includes(searchLower));
    }

    return sorted.slice(0, limit);
  }
}
