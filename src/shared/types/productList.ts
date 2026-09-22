// Renderer-facing types for the Product Lists feature. Kept as plain interfaces
// (not the drizzle schema types) so the renderer never imports server code.
// Timestamps arrive over IPC as Date via structured clone, but tolerate strings.

export type ProductListStatus = 'open' | 'ordered' | 'archived';

export interface ProductList {
  id: number;
  title: string;
  note: string | null;
  status: ProductListStatus;
  createdByEmployeeId: number | null;
  createdByName: string | null;
  orderedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProductListItem {
  id: number;
  listId: number;
  sku: string;
  isVariant: boolean;
  description: string | null;
  note: string | null;
  sortOrder: number;
  addedAt: string | Date;
}

export interface ProductListWithCount extends ProductList {
  itemCount: number;
}

export interface ProductListWithItems extends ProductList {
  items: ProductListItem[];
}

/** Snapshot of a product being attached to a list. */
export interface AddListItemInput {
  sku: string;
  isVariant?: boolean;
  description?: string | null;
  note?: string | null;
}

export interface CreateListInput {
  title: string;
  note?: string | null;
  createdByEmployeeId?: number | null;
  createdByName?: string | null;
}

export interface AddItemResult {
  item: ProductListItem | null;
  duplicate: boolean;
}
