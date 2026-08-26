import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, asc, count, or } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface VariantQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  parentSku?: string;
  activeOnly?: boolean;
}

export interface VariantWithInventory extends schema.Variant {
  parentDescription1?: string | null;
  parentDescription2?: string | null;
  parentCategory?: string | null;
  parentIsTaxable?: boolean;
}

export class BaseVariantDeletionError extends Error {
  constructor(variantSku: string) {
    super(`Cannot delete base variant '${variantSku}'. Delete the parent inventory item instead.`);
    this.name = 'BaseVariantDeletionError';
  }
}

export class DuplicateBaseVariantError extends Error {
  constructor(parentSku: string) {
    super(`A base variant already exists for inventory item '${parentSku}'.`);
    this.name = 'DuplicateBaseVariantError';
  }
}

export class VariantService extends BaseService<
  typeof schema.variants,
  schema.Variant,
  schema.InsertVariant
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.variants);
  }

  /**
   * Override create to validate no duplicate base variants
   */
  async create(data: schema.InsertVariant): Promise<schema.Variant> {
    // If creating a base variant, check if one already exists
    if (data.isBase) {
      const existingBase = await this.findBaseVariant(data.parentSku);
      if (existingBase) {
        throw new DuplicateBaseVariantError(data.parentSku);
      }
    }
    return super.create(data);
  }

  /**
   * Override delete to prevent deletion of base variants
   */
  async delete(id: number): Promise<boolean> {
    const variant = await this.findById(id);
    if (variant?.isBase) {
      throw new BaseVariantDeletionError(variant.variantSku);
    }
    return super.delete(id);
  }

  /**
   * Find the base variant for an inventory item
   */
  async findBaseVariant(parentSku: string): Promise<schema.Variant | null> {
    const results = await this.db
      .select()
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, parentSku), eq(schema.variants.isBase, true)))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Check if a variant is a base variant
   */
  isBaseVariant(variant: schema.Variant): boolean {
    return variant.isBase === true;
  }

  async findPaginated(params: VariantQueryParams = {}): Promise<PaginatedResult<schema.Variant>> {
    const { page = 1, pageSize = 50, search, parentSku, activeOnly = false } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.variants.variantSku, searchTerm),
          ilike(schema.variants.variantName, searchTerm),
          ilike(schema.variants.description, searchTerm),
          ilike(schema.variants.parentSku, searchTerm)
        )
      );
    }

    if (parentSku) {
      conditions.push(eq(schema.variants.parentSku, parentSku));
    }

    if (activeOnly) {
      conditions.push(eq(schema.variants.isActive, true));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.variants)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.variants)
      .where(whereCondition)
      .orderBy(asc(schema.variants.variantSku))
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

  async findByParentSku(parentSku: string): Promise<schema.Variant[]> {
    return this.db
      .select()
      .from(schema.variants)
      .where(eq(schema.variants.parentSku, parentSku))
      .orderBy(asc(schema.variants.variantSku));
  }

  async findByInventoryId(inventoryId: number): Promise<schema.Variant[]> {
    // First get the inventory item to find its SKU
    const inventoryItem = await this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.id, inventoryId))
      .limit(1);

    if (!inventoryItem[0]) {
      return [];
    }

    return this.findByParentSku(inventoryItem[0].sku);
  }

  async findByBarcode(barcode: string): Promise<schema.Variant | null> {
    // Search for variant by variantSku (which may contain barcode)
    const results = await this.db
      .select()
      .from(schema.variants)
      .where(eq(schema.variants.variantSku, barcode))
      .limit(1);
    return results[0] || null;
  }

  async findByVariantSku(variantSku: string): Promise<schema.Variant | null> {
    const results = await this.db
      .select()
      .from(schema.variants)
      .where(eq(schema.variants.variantSku, variantSku))
      .limit(1);
    return results[0] || null;
  }

  async findActive(parentSku?: string): Promise<schema.Variant[]> {
    const conditions = [eq(schema.variants.isActive, true)];

    if (parentSku) {
      conditions.push(eq(schema.variants.parentSku, parentSku));
    }

    return this.db
      .select()
      .from(schema.variants)
      .where(and(...conditions))
      .orderBy(asc(schema.variants.variantSku));
  }

  async searchForSelect(query: string, limit = 20): Promise<VariantWithInventory[]> {
    const conditions = [];

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(schema.variants.variantSku, searchTerm),
          ilike(schema.variants.variantName, searchTerm),
          ilike(schema.variants.parentSku, searchTerm),
          ilike(schema.inventory.description1, searchTerm)
        )
      );
    }

    // Always filter active variants
    conditions.push(eq(schema.variants.isActive, true));

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db
      .select({
        id: schema.variants.id,
        parentSku: schema.variants.parentSku,
        variantSku: schema.variants.variantSku,
        variantName: schema.variants.variantName,
        attributes: schema.variants.attributes,
        description: schema.variants.description,
        quantity: schema.variants.quantity,
        cost: schema.variants.cost,
        costCurrency: schema.variants.costCurrency,
        price: schema.variants.price,
        priceCurrency: schema.variants.priceCurrency,
        wholesalePrice: schema.variants.wholesalePrice,
        isActive: schema.variants.isActive,
        isBase: schema.variants.isBase,
        createdAt: schema.variants.createdAt,
        updatedAt: schema.variants.updatedAt,
        parentDescription1: schema.inventory.description1,
        parentDescription2: schema.inventory.description2,
        parentCategory: schema.inventory.category,
        parentIsTaxable: schema.inventory.isTaxable,
      })
      .from(schema.variants)
      .innerJoin(schema.inventory, eq(schema.variants.parentSku, schema.inventory.sku))
      .where(whereCondition)
      .orderBy(asc(schema.variants.variantSku))
      .limit(limit);

    return results;
  }

  async updateQuantity(id: number, quantityChange: number): Promise<schema.Variant | null> {
    const variant = await this.findById(id);
    if (!variant) return null;

    return this.update(id, {
      quantity: variant.quantity + quantityChange,
      updatedAt: new Date(),
    });
  }

  async setQuantity(id: number, quantity: number): Promise<schema.Variant | null> {
    return this.update(id, { quantity, updatedAt: new Date() });
  }

  async updateStock(id: number, quantity: number): Promise<schema.Variant | null> {
    return this.update(id, { quantity, updatedAt: new Date() });
  }

  async setStock(id: number, stockQty: number): Promise<schema.Variant | null> {
    return this.update(id, { quantity: stockQty, updatedAt: new Date() });
  }

  async updatePrice(id: number, price: string): Promise<schema.Variant | null> {
    return this.update(id, { price, updatedAt: new Date() });
  }

  async deactivate(id: number): Promise<schema.Variant | null> {
    return this.update(id, { isActive: false, updatedAt: new Date() });
  }

  async activate(id: number): Promise<schema.Variant | null> {
    return this.update(id, { isActive: true, updatedAt: new Date() });
  }

  async findLowStock(): Promise<schema.Variant[]> {
    // Return variants with quantity <= 0 that are active
    return this.db
      .select()
      .from(schema.variants)
      .where(
        and(
          eq(schema.variants.isActive, true),
          eq(schema.variants.quantity, 0)
        )
      );
  }
}
