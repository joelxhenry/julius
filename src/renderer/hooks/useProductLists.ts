import { IpcChannel } from '../../shared/types/ipc';
import type {
  ProductList,
  ProductListStatus,
  ProductListWithCount,
  ProductListWithItems,
  AddListItemInput,
  CreateListInput,
  AddItemResult,
} from '../../shared/types/productList';

// Unwrap the standard { success, data, error } IPC envelope, throwing on failure.
async function invoke<T>(channel: IpcChannel, payload?: unknown): Promise<T> {
  const res = await window.electron.invoke(channel, payload);
  if (!res?.success) {
    throw new Error(res?.error || 'Request failed');
  }
  return res.data as T;
}

export const productListsApi = {
  list: (status?: ProductListStatus) =>
    invoke<ProductListWithCount[]>(IpcChannel.GET_PRODUCT_LISTS, { status }),

  get: (id: number) =>
    invoke<ProductListWithItems>(IpcChannel.GET_PRODUCT_LIST, { id }),

  searchOpen: (query: string, limit = 20) =>
    invoke<ProductList[]>(IpcChannel.SEARCH_PRODUCT_LISTS_FOR_SELECT, { query, limit }),

  create: (data: CreateListInput) =>
    invoke<ProductList>(IpcChannel.CREATE_PRODUCT_LIST, data),

  update: (id: number, data: { title?: string; note?: string | null }) =>
    invoke<ProductList>(IpcChannel.UPDATE_PRODUCT_LIST, { id, data }),

  remove: (id: number) =>
    invoke<{ deleted: boolean }>(IpcChannel.DELETE_PRODUCT_LIST, { id }),

  setStatus: (id: number, status: ProductListStatus) =>
    invoke<ProductList>(IpcChannel.SET_PRODUCT_LIST_STATUS, { id, status }),

  addItem: (listId: number, item: AddListItemInput) =>
    invoke<AddItemResult>(IpcChannel.ADD_PRODUCT_LIST_ITEM, { listId, item }),

  createWithItem: (list: CreateListInput, item: AddListItemInput) =>
    invoke<{ list: ProductList; item: unknown }>(IpcChannel.CREATE_PRODUCT_LIST_WITH_ITEM, { list, item }),

  updateItem: (itemId: number, data: { note?: string | null }) =>
    invoke<unknown>(IpcChannel.UPDATE_PRODUCT_LIST_ITEM, { itemId, data }),

  removeItem: (itemId: number) =>
    invoke<{ removed: boolean }>(IpcChannel.REMOVE_PRODUCT_LIST_ITEM, { itemId }),

  reorderItems: (listId: number, orderedIds: number[]) =>
    invoke<{ reordered: boolean }>(IpcChannel.REORDER_PRODUCT_LIST_ITEMS, { listId, orderedIds }),
};

export function useProductLists() {
  return productListsApi;
}
