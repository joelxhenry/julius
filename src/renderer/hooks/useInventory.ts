import { useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';

export interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  category: string | null;
  model: string | null;
  location: string | null;
  unit: string;
  quantity: number;
  minLevel: number;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  wholesalePrice: string | null;
  margin: string | null;
  isTaxable: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateInventoryData {
  sku: string;
  description1?: string | null;
  description2?: string | null;
  category?: string | null;
  model?: string | null;
  location?: string | null;
  unit?: string;
  quantity?: number;
  minLevel?: number;
  cost?: string;
  costCurrency?: string;
  price?: string;
  priceCurrency?: string;
  wholesalePrice?: string | null;
  margin?: string | null;
  isTaxable?: boolean;
}

export interface UpdateInventoryData extends Partial<Omit<CreateInventoryData, 'sku'>> {}

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useInventory() {
  const getInventory = useCallback(async (): Promise<IpcResult<InventoryItem[]>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY, {});
  }, []);

  const getInventoryPaginated = useCallback(async (
    params: InventoryQueryParams
  ): Promise<IpcResult<PaginatedResult<InventoryItem>>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY_PAGINATED, params);
  }, []);

  const getInventoryItem = useCallback(async (
    id: number
  ): Promise<IpcResult<InventoryItem>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY_ITEM, { id });
  }, []);

  const getInventoryBySku = useCallback(async (
    sku: string
  ): Promise<IpcResult<InventoryItem>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku });
  }, []);

  const getLowStockInventory = useCallback(async (): Promise<IpcResult<InventoryItem[]>> => {
    return window.electron.invoke(IpcChannel.GET_LOW_STOCK_INVENTORY, {});
  }, []);

  const getActiveInventory = useCallback(async (): Promise<IpcResult<InventoryItem[]>> => {
    return window.electron.invoke(IpcChannel.GET_ACTIVE_INVENTORY, {});
  }, []);

  const searchInventory = useCallback(async (
    query: string
  ): Promise<IpcResult<InventoryItem[]>> => {
    return window.electron.invoke(IpcChannel.SEARCH_INVENTORY, { query });
  }, []);

  const searchInventoryForSelect = useCallback(async (
    query: string,
    limit?: number
  ): Promise<IpcResult<InventoryItem[]>> => {
    return window.electron.invoke(IpcChannel.SEARCH_INVENTORY_FOR_SELECT, { query, limit });
  }, []);

  const createInventory = useCallback(async (
    data: CreateInventoryData
  ): Promise<IpcResult<InventoryItem>> => {
    return window.electron.invoke(IpcChannel.CREATE_INVENTORY, data);
  }, []);

  const updateInventory = useCallback(async (
    id: number,
    data: UpdateInventoryData
  ): Promise<IpcResult<InventoryItem>> => {
    return window.electron.invoke(IpcChannel.UPDATE_INVENTORY, { id, data });
  }, []);

  const deleteInventory = useCallback(async (
    id: number
  ): Promise<IpcResult<boolean>> => {
    return window.electron.invoke(IpcChannel.DELETE_INVENTORY, { id });
  }, []);

  const updateInventoryStock = useCallback(async (
    id: number,
    quantity: number
  ): Promise<IpcResult<InventoryItem>> => {
    return window.electron.invoke(IpcChannel.UPDATE_INVENTORY_STOCK, { id, quantity });
  }, []);

  return {
    getInventory,
    getInventoryPaginated,
    getInventoryItem,
    getInventoryBySku,
    getLowStockInventory,
    getActiveInventory,
    searchInventory,
    searchInventoryForSelect,
    createInventory,
    updateInventory,
    deleteInventory,
    updateInventoryStock,
  };
}
