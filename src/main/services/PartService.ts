import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, like, or, and, ilike, desc, count } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface PartQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export class PartService extends BaseService<
  typeof schema.parts,
  schema.Part,
  schema.InsertPart
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.parts);
  }

  async findPaginated(params: PartQueryParams = {}): Promise<PaginatedResult<schema.Part>> {
    const { page = 1, pageSize = 50, search, category } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.parts.name, searchTerm),
          ilike(schema.parts.sku, searchTerm),
          ilike(schema.parts.description, searchTerm)
        )
      );
    }

    if (category && category !== 'all') {
      conditions.push(eq(schema.parts.category, category));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.parts)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.parts)
      .where(whereCondition)
      .orderBy(desc(schema.parts.id))
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

  async findBySku(sku: string): Promise<schema.Part | null> {
    const results = await this.db
      .select()
      .from(schema.parts)
      .where(eq(schema.parts.sku, sku))
      .limit(1);
    return results[0] || null;
  }

  async findByCategory(category: string): Promise<schema.Part[]> {
    return this.db
      .select()
      .from(schema.parts)
      .where(eq(schema.parts.category, category));
  }

  async search(query: string): Promise<schema.Part[]> {
    return this.db
      .select()
      .from(schema.parts)
      .where(
        or(
          like(schema.parts.name, `%${query}%`),
          like(schema.parts.sku, `%${query}%`),
          like(schema.parts.description, `%${query}%`)
        )
      );
  }

  async updatePrice(id: number, price: number): Promise<schema.Part | null> {
    return this.update(id, { price });
  }
}

export class PartVariantService extends BaseService<
  typeof schema.partVariants,
  schema.PartVariant,
  schema.InsertPartVariant
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.partVariants);
  }

  async findByPartId(partId: number): Promise<schema.PartVariant[]> {
    return this.db
      .select()
      .from(schema.partVariants)
      .where(eq(schema.partVariants.partId, partId));
  }

  async findByBarcode(barcode: string): Promise<schema.PartVariant | null> {
    const results = await this.db
      .select()
      .from(schema.partVariants)
      .where(eq(schema.partVariants.barcode, barcode))
      .limit(1);
    return results[0] || null;
  }

  async findActive(partId?: number): Promise<schema.PartVariant[]> {
    if (partId) {
      return this.db
        .select()
        .from(schema.partVariants)
        .where(
          and(
            eq(schema.partVariants.active, true),
            eq(schema.partVariants.partId, partId)
          )
        );
    }
    return this.db
      .select()
      .from(schema.partVariants)
      .where(eq(schema.partVariants.active, true));
  }

  async findLowStock(): Promise<schema.PartVariant[]> {
    return this.db
      .select()
      .from(schema.partVariants)
      .where(
        and(
          eq(schema.partVariants.active, true),
          // stockQty <= reorderLevel
        )
      );
  }

  async updateStock(id: number, quantity: number): Promise<schema.PartVariant | null> {
    const variant = await this.findById(id);
    if (!variant) return null;
    
    return this.update(id, { stockQty: variant.stockQty + quantity });
  }

  async setStock(id: number, stockQty: number): Promise<schema.PartVariant | null> {
    return this.update(id, { stockQty });
  }

  async updatePrice(id: number, price: number): Promise<schema.PartVariant | null> {
    return this.update(id, { price });
  }

  async deactivate(id: number): Promise<schema.PartVariant | null> {
    return this.update(id, { active: false });
  }

  async activate(id: number): Promise<schema.PartVariant | null> {
    return this.update(id, { active: true });
  }

  // Type for part variant with joined part info
  async searchForSelect(query: string, limit = 20): Promise<PartVariantWithPart[]> {
    const conditions = [];

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(schema.parts.name, searchTerm),
          ilike(schema.partVariants.name, searchTerm),
          ilike(schema.partVariants.sku, searchTerm),
          ilike(schema.parts.sku, searchTerm)
        )
      );
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await this.db
      .select({
        id: schema.partVariants.id,
        partId: schema.partVariants.partId,
        sku: schema.partVariants.sku,
        name: schema.partVariants.name,
        description: schema.partVariants.description,
        isGeneric: schema.partVariants.isGeneric,
        cost: schema.partVariants.cost,
        price: schema.partVariants.price,
        wholesalePrice: schema.partVariants.wholesalePrice,
        currency: schema.partVariants.currency,
        margin: schema.partVariants.margin,
        stockQty: schema.partVariants.stockQty,
        reorderLevel: schema.partVariants.reorderLevel,
        barcode: schema.partVariants.barcode,
        location: schema.partVariants.location,
        createdAt: schema.partVariants.createdAt,
        partName: schema.parts.name,
        partSku: schema.parts.sku,
        taxable: schema.parts.taxable,
      })
      .from(schema.partVariants)
      .innerJoin(schema.parts, eq(schema.partVariants.partId, schema.parts.id))
      .where(whereCondition)
      .orderBy(desc(schema.partVariants.id))
      .limit(limit);

    return results;
  }
}

export interface PartVariantWithPart extends schema.PartVariant {
  partName: string;
  partSku: string;
  taxable: boolean;
}
