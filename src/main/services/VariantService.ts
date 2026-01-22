import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, ilike, desc, count, or } from 'drizzle-orm';
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

export class VariantService extends BaseService<
  typeof schema.variants,
  schema.Variant,
  schema.InsertVariant
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.variants);
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
      .orderBy(desc(schema.variants.id))
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
      .where(eq(schema.variants.parentSku, parentSku));
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
      .where(and(...conditions));
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
      .orderBy(desc(schema.variants.id))
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
