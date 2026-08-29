import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

// The service db or an open transaction - both expose the same query builder,
// so the receival-posting helpers can run against either.
type DbExecutor =
  | NodePgDatabase<typeof schema>
  | Parameters<Parameters<NodePgDatabase<typeof schema>['transaction']>[0]>[0];

/**
 * A part to create on the fly while posting a receival (import inline-create).
 * Mirrors the required fields of the NewPartModal / CREATE_INVENTORY flow.
 */
export interface NewPartInput {
  sku: string;
  description1?: string | null;
  description2?: string | null;
  category?: string | null;
  model?: string | null;
  location?: string | null;
  unit?: string;
  minLevel?: number;
  isTaxable?: boolean;
}

/**
 * One received line. Either targets an existing product (`sku`) / specific
 * variant (`variantSku`), or carries a `newPart` payload that is created inside
 * the posting transaction before stock/pricing is applied.
 */
export interface ReceivalLineInput {
  sku?: string | null;
  variantSku?: string | null;
  newPart?: NewPartInput | null;
  quantity: number;
  unitCost: number;
  costCurrency?: string;
  // Pricing override (only applied when applyNewPricing is true).
  applyNewPricing?: boolean;
  newPrice?: number | null;
  priceCurrency?: string;
  newWholesale?: number | null;
  margin?: number | null;
}

export interface ReceivalHeaderInput {
  supplierId: number | null;
  supplier: string | null;
  receivingDate: string; // YYYY-MM-DD
  reference: string | null;
  notes?: string | null;
}

export interface PostReceivalInput {
  header: ReceivalHeaderInput;
  lines: ReceivalLineInput[];
}

const money = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);

export interface ReceivalQueryParams {
  page?: number;
  pageSize?: number;
}

export class GoodsReceivalService extends BaseService<
  typeof schema.goodsReceivals,
  schema.GoodsReceival,
  schema.InsertGoodsReceival
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.goodsReceivals);
  }

  /**
   * Post a whole receival atomically: header + every line's stock increment,
   * RECEIVE ledger row, last-cost update, optional price override, and receiving
   * line record all commit together or roll back together.
   */
  async postReceival(input: PostReceivalInput): Promise<{
    receival: schema.GoodsReceival;
    lines: schema.InventoryReceiving[];
  }> {
    const { header, lines } = input;
    if (!lines.length) throw new Error('A receival needs at least one line');

    const activityDate = header.receivingDate;

    return this.db.transaction(async (tx) => {
      // 1. Insert the receival header.
      const [receival] = await tx
        .insert(schema.goodsReceivals)
        .values({
          reference: header.reference,
          supplierId: header.supplierId ?? undefined,
          supplier: header.supplier,
          receivingDate: header.receivingDate,
          status: 'posted',
          notes: header.notes ?? undefined,
        })
        .returning();

      const lineRecords: schema.InventoryReceiving[] = [];
      let totalQuantity = 0;
      let totalCost = 0;

      for (const line of lines) {
        if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
          throw new Error('Each line needs a received quantity greater than 0');
        }
        if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
          throw new Error('Each line needs a non-negative unit cost');
        }

        // 2. Resolve the target: create the part first when this is a new one.
        if (line.newPart) {
          await this.createPart(tx, line.newPart, {
            cost: line.unitCost,
            costCurrency: line.costCurrency ?? 'JA',
            price: line.applyNewPricing ? line.newPrice ?? null : null,
            priceCurrency: line.priceCurrency ?? 'JA',
            wholesalePrice: line.applyNewPricing ? line.newWholesale ?? null : null,
          });
        }

        const targetSku = line.variantSku ?? line.sku ?? line.newPart?.sku;
        if (!targetSku) throw new Error('Each line needs a part number');

        const resolved = await this.resolveTarget(tx, targetSku);
        if (!resolved) {
          throw new Error(`Part ${targetSku} was not found in inventory or variants`);
        }

        // 3a. Stock: bump the resolved variant and keep the product aggregate in sync.
        await tx.execute(
          sql`UPDATE variants SET quantity = quantity + ${line.quantity}, updated_at = NOW() WHERE variant_sku = ${resolved.variantSku}`
        );
        await tx.execute(
          sql`UPDATE inventory SET quantity = quantity + ${line.quantity}, updated_at = NOW() WHERE sku = ${resolved.parentSku}`
        );

        // 3b. Ledger row.
        await tx.insert(schema.inventoryTransactions).values({
          sku: resolved.parentSku,
          variantSku: resolved.variantSku,
          activity: 'RECEIVE',
          reference: header.reference,
          quantity: line.quantity,
          activityDate,
        });

        // 3c. Cost always updates; snapshot the prior cost for the receiving record.
        const priorCost = resolved.currentCost;
        await this.applyCost(tx, resolved, money(line.unitCost), line.costCurrency ?? 'JA');

        // 3d. Pricing only when the line opts in.
        let appliedPrice: string | null = null;
        let appliedWholesale: string | null = null;
        if (line.applyNewPricing) {
          appliedPrice =
            line.newPrice != null && Number.isFinite(line.newPrice) ? money(line.newPrice) : null;
          appliedWholesale =
            line.newWholesale != null && Number.isFinite(line.newWholesale)
              ? money(line.newWholesale)
              : null;
          await this.applyPricing(tx, resolved, {
            price: appliedPrice,
            priceCurrency: line.priceCurrency ?? 'JA',
            wholesalePrice: appliedWholesale,
            margin:
              line.margin != null && Number.isFinite(line.margin) ? money(line.margin) : null,
          });
        }

        // 3e. Receiving line record.
        const [record] = await tx
          .insert(schema.inventoryReceiving)
          .values({
            receivalId: receival.id,
            sku: resolved.parentSku,
            variantSku: line.variantSku ? resolved.variantSku : undefined,
            supplierId: header.supplierId ?? undefined,
            supplier: header.supplier,
            receivingDate: header.receivingDate,
            quantity: line.quantity,
            lastCost: money(line.unitCost),
            lastCostCurrency: line.costCurrency ?? 'JA',
            priorCost: priorCost ?? undefined,
            lastPrice: appliedPrice ?? undefined,
            lastPriceCurrency: appliedPrice ? line.priceCurrency ?? 'JA' : undefined,
            lastWholesalePrice: appliedWholesale ?? undefined,
            reference: header.reference,
          })
          .returning();

        lineRecords.push(record);
        totalQuantity += line.quantity;
        totalCost += line.quantity * line.unitCost;
      }

      // 4. Roll the totals up onto the header.
      const [updatedReceival] = await tx
        .update(schema.goodsReceivals)
        .set({
          lineCount: lineRecords.length,
          totalQuantity,
          totalCost: money(totalCost),
        })
        .where(eq(schema.goodsReceivals.id, receival.id))
        .returning();

      return { receival: updatedReceival, lines: lineRecords };
    });
  }

  /**
   * Create a new inventory part (+ its base variant) inside the given executor,
   * mirroring InventoryService.create so the base variant carries the same
   * pricing/stock the product is created with.
   */
  private async createPart(
    exec: DbExecutor,
    part: NewPartInput,
    pricing: {
      cost: number;
      costCurrency: string;
      price: number | null;
      priceCurrency: string;
      wholesalePrice: number | null;
    }
  ): Promise<void> {
    const cost = money(pricing.cost);
    const price = pricing.price != null ? money(pricing.price) : '0';
    const wholesale = pricing.wholesalePrice != null ? money(pricing.wholesalePrice) : null;

    await exec.insert(schema.inventory).values({
      sku: part.sku,
      description1: part.description1 ?? null,
      description2: part.description2 ?? null,
      category: part.category ?? null,
      model: part.model ?? null,
      location: part.location ?? null,
      unit: part.unit ?? 'EA',
      quantity: 0,
      minLevel: part.minLevel ?? 0,
      isTaxable: part.isTaxable ?? true,
      cost,
      costCurrency: pricing.costCurrency,
      price,
      priceCurrency: pricing.priceCurrency,
      wholesalePrice: wholesale ?? undefined,
    });

    await exec.insert(schema.variants).values({
      parentSku: part.sku,
      variantSku: part.sku,
      variantName: part.description1 || 'Base',
      location: part.location ?? undefined,
      description: part.description2 ?? undefined,
      quantity: 0,
      cost,
      costCurrency: pricing.costCurrency,
      price,
      priceCurrency: pricing.priceCurrency,
      wholesalePrice: wholesale ?? undefined,
      isActive: true,
      isBase: true,
      attributes: {},
    });
  }

  /**
   * Resolve a SKU to the concrete variant it should move stock on: a specific
   * variant, or the product's base variant. Returns null if unknown.
   */
  private async resolveTarget(
    exec: DbExecutor,
    sku: string
  ): Promise<{
    parentSku: string;
    variantSku: string;
    isBase: boolean;
    currentCost: string | null;
  } | null> {
    const variant = await exec
      .select({
        parentSku: schema.variants.parentSku,
        variantSku: schema.variants.variantSku,
        isBase: schema.variants.isBase,
        cost: schema.variants.cost,
      })
      .from(schema.variants)
      .where(eq(schema.variants.variantSku, sku))
      .limit(1);

    if (variant.length > 0) {
      return {
        parentSku: variant[0].parentSku,
        variantSku: variant[0].variantSku,
        isBase: variant[0].isBase,
        currentCost: variant[0].cost,
      };
    }

    // SKU is a product without a matching variant row - resolve its base variant.
    const inv = await exec
      .select({ sku: schema.inventory.sku, cost: schema.inventory.cost })
      .from(schema.inventory)
      .where(eq(schema.inventory.sku, sku))
      .limit(1);
    if (inv.length === 0) return null;

    const base = await exec
      .select({ variantSku: schema.variants.variantSku })
      .from(schema.variants)
      .where(and(eq(schema.variants.parentSku, sku), eq(schema.variants.isBase, true)))
      .limit(1);
    if (base.length === 0) return null;

    return {
      parentSku: inv[0].sku,
      variantSku: base[0].variantSku,
      isBase: true,
      currentCost: inv[0].cost,
    };
  }

  /** Update last cost on the product (when base) and always on the target variant. */
  private async applyCost(
    exec: DbExecutor,
    target: { parentSku: string; variantSku: string; isBase: boolean },
    cost: string,
    costCurrency: string
  ): Promise<void> {
    await exec
      .update(schema.variants)
      .set({ cost, costCurrency, updatedAt: new Date() })
      .where(eq(schema.variants.variantSku, target.variantSku));

    if (target.isBase) {
      await exec
        .update(schema.inventory)
        .set({ cost, costCurrency, updatedAt: new Date() })
        .where(eq(schema.inventory.sku, target.parentSku));
    }
  }

  /**
   * Override selling / wholesale price. For a base-variant target this updates
   * the product row and mirrors onto the base variant, exactly like
   * InventoryService.update, so invoices/quotes read the new price. For a
   * specific variant it updates that variant only.
   */
  private async applyPricing(
    exec: DbExecutor,
    target: { parentSku: string; variantSku: string; isBase: boolean },
    pricing: {
      price: string | null;
      priceCurrency: string;
      wholesalePrice: string | null;
      margin: string | null;
    }
  ): Promise<void> {
    const variantSet: Partial<schema.InsertVariant> = { updatedAt: new Date() };
    if (pricing.price != null) {
      variantSet.price = pricing.price;
      variantSet.priceCurrency = pricing.priceCurrency;
    }
    if (pricing.wholesalePrice != null) variantSet.wholesalePrice = pricing.wholesalePrice;

    if (Object.keys(variantSet).length > 1) {
      await exec
        .update(schema.variants)
        .set(variantSet)
        .where(eq(schema.variants.variantSku, target.variantSku));
    }

    if (target.isBase) {
      const invSet: Partial<schema.InsertInventory> = { updatedAt: new Date() };
      if (pricing.price != null) {
        invSet.price = pricing.price;
        invSet.priceCurrency = pricing.priceCurrency;
      }
      if (pricing.wholesalePrice != null) invSet.wholesalePrice = pricing.wholesalePrice;
      if (pricing.margin != null) invSet.margin = pricing.margin;
      if (Object.keys(invSet).length > 1) {
        await exec
          .update(schema.inventory)
          .set(invSet)
          .where(eq(schema.inventory.sku, target.parentSku));
      }
    }
  }

  // ----- Reads (history / reprint) -----

  async findAllPaginated(
    params: ReceivalQueryParams = {}
  ): Promise<PaginatedResult<schema.GoodsReceival>> {
    const { page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    const countResult = await this.db.select({ count: count() }).from(schema.goodsReceivals);
    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.goodsReceivals)
      .orderBy(desc(schema.goodsReceivals.createdAt))
      .limit(pageSize)
      .offset(offset);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findWithLines(
    id: number
  ): Promise<{ receival: schema.GoodsReceival; lines: schema.InventoryReceiving[] } | null> {
    const receival = await this.findById(id);
    if (!receival) return null;
    const lines = await this.db
      .select()
      .from(schema.inventoryReceiving)
      .where(eq(schema.inventoryReceiving.receivalId, id))
      .orderBy(schema.inventoryReceiving.id);
    return { receival, lines };
  }
}
