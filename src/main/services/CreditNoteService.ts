import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, desc, count, or, ilike, sql } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { PaginatedResult } from './types';

export interface CreditNoteQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  clientId?: number;
  includeArchived?: boolean;
}

export class CreditNoteService extends BaseService<
  typeof schema.creditNotes,
  schema.CreditNote,
  schema.InsertCreditNote
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.creditNotes);
  }

  async create(data: schema.InsertCreditNote): Promise<schema.CreditNote> {
    let crNumber = data.crNumber;
    if (!crNumber) {
      const countResult = await this.db
        .select({ cnt: count() })
        .from(schema.creditNotes);
      const nextNum = Number(countResult[0]?.cnt ?? 0) + 1;
      crNumber = `CR${nextNum.toString().padStart(4, '0')}`;
    }
    const results = await this.db
      .insert(schema.creditNotes)
      .values({ ...data, crNumber })
      .returning();
    return results[0];
  }

  async findPaginated(params: CreditNoteQueryParams = {}): Promise<PaginatedResult<schema.CreditNote>> {
    const { page = 1, pageSize = 50, search, status, clientId, includeArchived = false } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];

    if (!includeArchived) {
      conditions.push(eq(schema.creditNotes.isArchived, false));
    }

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.creditNotes.crNumber, searchTerm),
          ilike(schema.creditNotes.reference, searchTerm),
          ilike(schema.creditNotes.clientName, searchTerm)
        )
      );
    }

    if (status && status !== 'all') {
      conditions.push(eq(schema.creditNotes.status, status));
    }

    if (clientId) {
      conditions.push(eq(schema.creditNotes.clientId, clientId));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await this.db
      .select({ count: count() })
      .from(schema.creditNotes)
      .where(whereCondition);

    const total = Number(countResult[0]?.count ?? 0);

    const data = await this.db
      .select()
      .from(schema.creditNotes)
      .where(whereCondition)
      .orderBy(desc(schema.creditNotes.createdAt))
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

  async findByCrNumber(crNumber: string): Promise<schema.CreditNote | null> {
    const results = await this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.crNumber, crNumber))
      .limit(1);
    return results[0] || null;
  }

  async findByClient(clientId: number): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.clientId, clientId))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findByInvoice(invNumber: string): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.invNumber, invNumber))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findBySalesperson(salespersonId: number): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(eq(schema.creditNotes.salespersonId, salespersonId))
      .orderBy(desc(schema.creditNotes.createdAt));
  }

  async findByDateRange(startDate: string, endDate: string): Promise<schema.CreditNote[]> {
    return this.db
      .select()
      .from(schema.creditNotes)
      .where(
        and(
          gte(schema.creditNotes.crDate, startDate),
          lte(schema.creditNotes.crDate, endDate)
        )
      )
      .orderBy(desc(schema.creditNotes.crDate));
  }

  async findUnused(): Promise<schema.CreditNote[]> {
    // Find credit notes where totalUsed < total
    const allCreditNotes = await this.db
      .select()
      .from(schema.creditNotes)
      .where(
        and(
          eq(schema.creditNotes.status, 'A'),
          eq(schema.creditNotes.isArchived, false)
        )
      );

    return allCreditNotes.filter(cn => {
      const total = parseFloat(cn.total || '0');
      const totalUsed = parseFloat(cn.totalUsed || '0');
      return totalUsed < total;
    });
  }

  async recordUsage(id: number, amount: string): Promise<schema.CreditNote | null> {
    const creditNote = await this.findById(id);
    if (!creditNote) return null;

    const currentUsed = parseFloat(creditNote.totalUsed || '0');
    const newTotalUsed = currentUsed + parseFloat(amount);
    const total = parseFloat(creditNote.total || '0');
    const newStatus = newTotalUsed >= total ? 'U' : 'A'; // U = Used, A = Active

    return this.update(id, {
      totalUsed: newTotalUsed.toFixed(2),
      status: newStatus,
    });
  }

  async archive(id: number): Promise<schema.CreditNote | null> {
    return this.update(id, { isArchived: true });
  }

  async restoreInventoryForCreditNote(
    crNumber: string,
    lineItems: Array<{ sku: string | null; quantity: number }>,
    crDate: string,
    activityType: string = 'CREDIT_RETURN',
  ): Promise<void> {
    for (const item of lineItems) {
      if (!item.sku || item.quantity <= 0) continue;

      // 1. Check if SKU is a variant
      const variant = await this.db
        .select({ id: schema.variants.id, parentSku: schema.variants.parentSku, variantSku: schema.variants.variantSku })
        .from(schema.variants)
        .where(eq(schema.variants.variantSku, item.sku))
        .limit(1);

      if (variant.length > 0) {
        await this.db.insert(schema.inventoryTransactions).values({
          sku: variant[0].parentSku,
          variantSku: variant[0].variantSku,
          activity: activityType,
          reference: crNumber,
          quantity: item.quantity,
          activityDate: crDate,
        });
        await this.db.execute(
          sql`UPDATE variants SET quantity = quantity + ${item.quantity}, updated_at = NOW() WHERE variant_sku = ${item.sku}`
        );
      } else {
        // 2. Check if SKU is an inventory item
        const inventoryItem = await this.db
          .select({ sku: schema.inventory.sku })
          .from(schema.inventory)
          .where(eq(schema.inventory.sku, item.sku))
          .limit(1);

        if (inventoryItem.length === 0) {
          console.warn(`SKU ${item.sku} not found in inventory or variants - inventory not restored`);
          continue;
        }

        // 3. Find base variant
        const baseVariant = await this.db
          .select({ variantSku: schema.variants.variantSku })
          .from(schema.variants)
          .where(and(eq(schema.variants.parentSku, item.sku), eq(schema.variants.isBase, true)))
          .limit(1);

        if (baseVariant.length > 0) {
          await this.db.insert(schema.inventoryTransactions).values({
            sku: item.sku,
            variantSku: baseVariant[0].variantSku,
            activity: activityType,
            reference: crNumber,
            quantity: item.quantity,
            activityDate: crDate,
          });
          await this.db.execute(
            sql`UPDATE variants SET quantity = quantity + ${item.quantity}, updated_at = NOW() WHERE variant_sku = ${baseVariant[0].variantSku}`
          );
        } else {
          // Fallback: no base variant, update inventory directly
          console.warn(`No base variant found for ${item.sku} - using legacy inventory`);
          await this.db.insert(schema.inventoryTransactions).values({
            sku: item.sku,
            activity: activityType,
            reference: crNumber,
            quantity: item.quantity,
            activityDate: crDate,
          });
          await this.db.execute(
            sql`UPDATE inventory SET quantity = quantity + ${item.quantity}, updated_at = NOW() WHERE sku = ${item.sku}`
          );
        }
      }
    }
  }
}
