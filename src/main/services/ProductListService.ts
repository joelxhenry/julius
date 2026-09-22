import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, asc, ilike, count, max, getTableColumns } from 'drizzle-orm';
import * as schema from '../database/schema';
import { BaseService } from './BaseService';
import { ProductListStatus } from '../database/schema';

export interface ProductListWithCount extends schema.ProductList {
  itemCount: number;
}

export interface ProductListWithItems extends schema.ProductList {
  items: schema.ProductListItem[];
}

export interface AddItemInput {
  sku: string;
  isVariant?: boolean;
  description?: string | null;
  note?: string | null;
}

export interface AddItemResult {
  item: schema.ProductListItem | null;
  duplicate: boolean;
}

export interface CreateListInput {
  title: string;
  note?: string | null;
  createdByEmployeeId?: number | null;
  createdByName?: string | null;
}

// Postgres unique-violation error code
const UNIQUE_VIOLATION = '23505';

export class ProductListService extends BaseService<
  typeof schema.productLists,
  schema.ProductList,
  schema.InsertProductList
> {
  constructor(db: NodePgDatabase<typeof schema>) {
    super(db, schema.productLists);
  }

  /**
   * All lists (optionally filtered by status), each with its item count,
   * newest first.
   */
  async findAllWithCounts(status?: ProductListStatus): Promise<ProductListWithCount[]> {
    const rows = await this.db
      .select({
        ...getTableColumns(schema.productLists),
        itemCount: count(schema.productListItems.id),
      })
      .from(schema.productLists)
      .leftJoin(
        schema.productListItems,
        eq(schema.productListItems.listId, schema.productLists.id)
      )
      .where(status ? eq(schema.productLists.status, status) : undefined)
      .groupBy(schema.productLists.id)
      .orderBy(desc(schema.productLists.createdAt));
    return rows as ProductListWithCount[];
  }

  /**
   * A single list with its items, ordered for display.
   */
  async findByIdWithItems(id: number): Promise<ProductListWithItems | null> {
    const list = await this.findById(id);
    if (!list) return null;
    const items = await this.db
      .select()
      .from(schema.productListItems)
      .where(eq(schema.productListItems.listId, id))
      .orderBy(asc(schema.productListItems.sortOrder), asc(schema.productListItems.addedAt));
    return { ...list, items };
  }

  /**
   * Open lists matching a title query - feeds the "add to list" picker.
   */
  async searchOpenLists(query: string, limit = 20): Promise<schema.ProductList[]> {
    const trimmed = (query ?? '').trim();
    return this.db
      .select()
      .from(schema.productLists)
      .where(
        trimmed
          ? and(
              eq(schema.productLists.status, 'open'),
              ilike(schema.productLists.title, `%${trimmed}%`)
            )
          : eq(schema.productLists.status, 'open')
      )
      .orderBy(desc(schema.productLists.updatedAt))
      .limit(limit);
  }

  async createList(data: CreateListInput): Promise<schema.ProductList> {
    return this.create({
      title: data.title,
      note: data.note ?? null,
      createdByEmployeeId: data.createdByEmployeeId ?? null,
      createdByName: data.createdByName ?? null,
    });
  }

  async updateList(
    id: number,
    data: Partial<Pick<schema.InsertProductList, 'title' | 'note'>>
  ): Promise<schema.ProductList | null> {
    return this.update(id, { ...data, updatedAt: new Date() });
  }

  async setStatus(id: number, status: ProductListStatus): Promise<schema.ProductList | null> {
    const patch: Partial<schema.InsertProductList> = { status, updatedAt: new Date() };
    if (status === 'ordered') patch.orderedAt = new Date();
    return this.update(id, patch);
  }

  /**
   * Attach a product to a list. Relies on the (list_id, sku, is_variant) unique
   * constraint to prevent duplicates; a duplicate is reported, not thrown.
   */
  async addItem(listId: number, input: AddItemInput): Promise<AddItemResult> {
    const nextSort = await this.nextSortOrder(listId);
    try {
      const results = await this.db
        .insert(schema.productListItems)
        .values({
          listId,
          sku: input.sku,
          isVariant: input.isVariant ?? false,
          description: input.description ?? null,
          note: input.note ?? null,
          sortOrder: nextSort,
        })
        .returning();
      // Touch the parent list so it sorts as recently used.
      await this.update(listId, { updatedAt: new Date() });
      return { item: results[0], duplicate: false };
    } catch (error) {
      if ((error as { code?: string })?.code === UNIQUE_VIOLATION) {
        return { item: null, duplicate: true };
      }
      throw error;
    }
  }

  /**
   * Create a new list and attach the first item atomically. Backs the modal's
   * "create new list" path.
   */
  async createListWithItem(
    listData: CreateListInput,
    item: AddItemInput
  ): Promise<{ list: schema.ProductList; item: schema.ProductListItem }> {
    return this.db.transaction(async (tx) => {
      const [list] = await tx
        .insert(schema.productLists)
        .values({
          title: listData.title,
          note: listData.note ?? null,
          createdByEmployeeId: listData.createdByEmployeeId ?? null,
          createdByName: listData.createdByName ?? null,
        })
        .returning();
      const [created] = await tx
        .insert(schema.productListItems)
        .values({
          listId: list.id,
          sku: item.sku,
          isVariant: item.isVariant ?? false,
          description: item.description ?? null,
          note: item.note ?? null,
          sortOrder: 0,
        })
        .returning();
      return { list, item: created };
    });
  }

  async updateItem(
    itemId: number,
    data: Partial<Pick<schema.InsertProductListItem, 'note'>>
  ): Promise<schema.ProductListItem | null> {
    const results = await this.db
      .update(schema.productListItems)
      .set(data)
      .where(eq(schema.productListItems.id, itemId))
      .returning();
    return results[0] || null;
  }

  async removeItem(itemId: number): Promise<boolean> {
    await this.db.delete(schema.productListItems).where(eq(schema.productListItems.id, itemId));
    return true;
  }

  /**
   * Persist a new order for a list's items. `orderedIds` is the full set of item
   * ids in the desired order.
   */
  async reorderItems(listId: number, orderedIds: number[]): Promise<boolean> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(schema.productListItems)
          .set({ sortOrder: i })
          .where(
            and(
              eq(schema.productListItems.id, orderedIds[i]),
              eq(schema.productListItems.listId, listId)
            )
          );
      }
    });
    return true;
  }

  private async nextSortOrder(listId: number): Promise<number> {
    const [row] = await this.db
      .select({ maxSort: max(schema.productListItems.sortOrder) })
      .from(schema.productListItems)
      .where(eq(schema.productListItems.listId, listId));
    return (row?.maxSort ?? -1) + 1;
  }
}
