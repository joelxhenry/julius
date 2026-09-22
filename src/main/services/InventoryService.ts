import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, and, ilike, asc, count, sql, inArray } from 'drizzle-orm';
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
 * Inventory row augmented with the total stock across all of its variants.
 * Mirrors the aggregation used on the detail page: prefer active variants,
 * fall back to all variants, then to the product-level quantity.
 */
export interface InventoryWithStock extends schema.Inventory {
  totalStock: number;
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
  category: string | null;
  model: string | null;
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
   * Override update to keep the base variant in sync with product-level fields.
   * Location and pricing (cost/price/wholesale, incl. currencies) are mirrored on
   * the base variant so downstream consumers that read the variant row - e.g. the
   * quote-to-invoice price check, which always references the base variant - see
   * fresh prices instead of the snapshot taken at product-create time.
   */
  async update(id: number, data: Partial<schema.InsertInventory>): Promise<schema.Inventory | null> {
    const item = await super.update(id, data);
    if (item) {
      const baseSync: Partial<schema.InsertVariant> = {};
      if (data.location !== undefined) baseSync.location = (data.location as string | null) ?? undefined;
      if (data.cost !== undefined) baseSync.cost = data.cost;
      if (data.costCurrency !== undefined) baseSync.costCurrency = data.costCurrency;
      if (data.price !== undefined) baseSync.price = data.price;
      if (data.priceCurrency !== undefined) baseSync.priceCurrency = data.priceCurrency;
      if (data.wholesalePrice !== undefined) baseSync.wholesalePrice = data.wholesalePrice ?? undefined;

      if (Object.keys(baseSync).length > 0) {
        baseSync.updatedAt = new Date();
        await this.db
          .update(schema.variants)
          .set(baseSync)
          .where(and(eq(schema.variants.parentSku, item.sku), eq(schema.variants.isBase, true)));
      }
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

  async findPaginated(params: InventoryQueryParams = {}): Promise<PaginatedResult<InventoryWithStock>> {
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

    // Aggregate variant quantities for this page so the Stock column reflects the
    // total across all variants. Prefer active variants (matching the detail page),
    // falling back to all variants, then to the product-level quantity.
    const skus = data.map((row) => row.sku);
    const stockBySku = new Map<string, { activeSum: number; activeCount: number; totalCount: number; totalSum: number }>();
    if (skus.length > 0) {
      const stockRows = await this.db
        .select({
          parentSku: schema.variants.parentSku,
          activeSum: sql<number>`coalesce(sum(case when ${schema.variants.isActive} then ${schema.variants.quantity} else 0 end), 0)`,
          activeCount: sql<number>`sum(case when ${schema.variants.isActive} then 1 else 0 end)`,
          totalSum: sql<number>`coalesce(sum(${schema.variants.quantity}), 0)`,
          totalCount: count(),
        })
        .from(schema.variants)
        .where(inArray(schema.variants.parentSku, skus))
        .groupBy(schema.variants.parentSku);

      for (const row of stockRows) {
        stockBySku.set(row.parentSku, {
          activeSum: Number(row.activeSum ?? 0),
          activeCount: Number(row.activeCount ?? 0),
          totalSum: Number(row.totalSum ?? 0),
          totalCount: Number(row.totalCount ?? 0),
        });
      }
    }

    const dataWithStock: InventoryWithStock[] = data.map((row) => {
      const stock = stockBySku.get(row.sku);
      let totalStock: number;
      if (stock && stock.activeCount > 0) {
        totalStock = stock.activeSum;
      } else if (stock && stock.totalCount > 0) {
        totalStock = stock.totalSum;
      } else {
        totalStock = row.quantity;
      }
      return { ...row, totalStock };
    });

    return {
      data: dataWithStock,
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

  /**
   * Resolve display labels (category + model) for a set of SKUs, handling both
   * inventory SKUs and variant SKUs (which inherit their parent inventory item's
   * labels). Lets line items always show make/category regardless of how the
   * part was entered. Runs in two queries regardless of how many SKUs are asked
   * for, and returns a row per requested SKU.
   */
  async getPartLabelsBySkus(
    skus: string[]
  ): Promise<Array<{ sku: string; category: string | null; model: string | null }>> {
    const unique = Array.from(new Set(skus.filter((s) => !!s)));
    if (unique.length === 0) return [];

    // Map any variant SKUs to their parent inventory SKU.
    const variantRows = await this.db
      .select({ variantSku: schema.variants.variantSku, parentSku: schema.variants.parentSku })
      .from(schema.variants)
      .where(inArray(schema.variants.variantSku, unique));
    const variantParent = new Map(variantRows.map((v) => [v.variantSku, v.parentSku]));

    // The inventory SKUs whose labels we actually need.
    const inventorySkus = Array.from(new Set(unique.map((s) => variantParent.get(s) ?? s)));

    const inventoryRows = await this.db
      .select({ sku: schema.inventory.sku, category: schema.inventory.category, model: schema.inventory.model })
      .from(schema.inventory)
      .where(inArray(schema.inventory.sku, inventorySkus));
    const labels = new Map(inventoryRows.map((r) => [r.sku, { category: r.category, model: r.model }]));

    return unique.map((s) => {
      const parent = variantParent.get(s) ?? s;
      const l = labels.get(parent);
      return { sku: s, category: l?.category ?? null, model: l?.model ?? null };
    });
  }

  async findByCategory(category: string): Promise<schema.Inventory[]> {
    return this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.category, category))
      .orderBy(asc(schema.inventory.sku));
  }

  async findByLocation(location: string): Promise<schema.Inventory[]> {
    return this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.location, location))
      .orderBy(asc(schema.inventory.sku));
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
      )
      .orderBy(asc(schema.inventory.sku));
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
      .orderBy(asc(schema.inventory.sku))
      .limit(limit);
  }

  async getVariantsBySku(parentSku: string): Promise<schema.Variant[]> {
    return this.db
      .select()
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isActive, true)))
      .orderBy(asc(schema.variants.variantSku));
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
  async searchWithVariants(
    query: string,
    limit = 20,
    filters: { category?: string; model?: string } = {}
  ): Promise<UnifiedSearchResult[]> {
    const results: UnifiedSearchResult[] = [];

    const trimmedQuery = query?.trim() ?? '';
    const category = filters.category?.trim() ?? '';
    const model = filters.model?.trim() ?? '';

    // Require at least one active filter - otherwise this would scan everything.
    if (!trimmedQuery && !category && !model) {
      return results;
    }

    // Build AND-combined conditions: free-text query (across sku/description/model)
    // plus optional category/model narrowing from the parent inventory record.
    const conditions = [eq(schema.variants.isActive, true)];

    if (trimmedQuery) {
      const searchTerm = `%${trimmedQuery}%`;
      conditions.push(
        or(
          ilike(schema.variants.variantSku, searchTerm),
          ilike(schema.variants.variantName, searchTerm),
          ilike(schema.variants.description, searchTerm),
          ilike(schema.variants.parentSku, searchTerm),
          ilike(schema.inventory.description1, searchTerm),
          ilike(schema.inventory.model, searchTerm)
        )!
      );
    }

    if (category) {
      conditions.push(ilike(schema.inventory.category, `%${category}%`)!);
    }

    if (model) {
      conditions.push(ilike(schema.inventory.model, `%${model}%`)!);
    }

    // Search variants only (includes base variants for all inventory items)
    // Also search by parent inventory fields (sku, description1, model)
    const variantItems = await this.db
      .select({
        variant: schema.variants,
        parent: schema.inventory,
      })
      .from(schema.variants)
      .leftJoin(schema.inventory, eq(schema.variants.parentSku, schema.inventory.sku))
      .where(and(...conditions))
      .orderBy(asc(schema.variants.variantSku))
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
        category: parent?.category ?? null,
        model: parent?.model ?? null,
      });
    }

    // Exact SKU match first (only meaningful when a text query was given),
    // then ascending by part number (SKU)
    const lowerQuery = trimmedQuery.toLowerCase();
    results.sort((a, b) => {
      if (lowerQuery) {
        const aExact = a.sku.toLowerCase() === lowerQuery ? 0 : 1;
        const bExact = b.sku.toLowerCase() === lowerQuery ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
      }
      return a.sku.localeCompare(b.sku, undefined, { numeric: true });
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
