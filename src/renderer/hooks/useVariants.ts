import { useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';

export interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
  attributes: Record<string, any>;
  description: string | null;
  barcode: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariantQueryParams {
  page?: number;
  limit?: number;
  parentSku?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateVariantData {
  parentSku: string;
  variantSku: string;
  variantName?: string | null;
  variantType?: string | null;
  attributes?: Record<string, any>;
  description?: string | null;
  barcode?: string | null;
  quantity?: number;
  cost?: string | null;
  costCurrency?: string;
  price?: string | null;
  priceCurrency?: string;
  wholesalePrice?: string | null;
  isActive?: boolean;
}

export interface UpdateVariantData extends Partial<Omit<CreateVariantData, 'parentSku' | 'variantSku'>> {}

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

export function useVariants() {
  const getVariants = useCallback(async (): Promise<IpcResult<Variant[]>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANTS, {});
  }, []);

  const getVariantsPaginated = useCallback(async (
    params: VariantQueryParams
  ): Promise<IpcResult<PaginatedResult<Variant>>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANTS_PAGINATED, params);
  }, []);

  const getVariant = useCallback(async (
    id: number
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANT, { id });
  }, []);

  const getVariantsByInventory = useCallback(async (
    inventoryId: number
  ): Promise<IpcResult<Variant[]>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANTS_BY_INVENTORY, { inventoryId });
  }, []);

  const getVariantByBarcode = useCallback(async (
    barcode: string
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANT_BY_BARCODE, { barcode });
  }, []);

  const getVariantBySku = useCallback(async (
    variantSku: string
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.GET_VARIANT_BY_SKU, { variantSku });
  }, []);

  const getActiveVariants = useCallback(async (): Promise<IpcResult<Variant[]>> => {
    return window.electron.invoke(IpcChannel.GET_ACTIVE_VARIANTS, {});
  }, []);

  const getLowStockVariants = useCallback(async (): Promise<IpcResult<Variant[]>> => {
    return window.electron.invoke(IpcChannel.GET_LOW_STOCK_VARIANTS, {});
  }, []);

  const searchVariantsForSelect = useCallback(async (
    query: string,
    parentSku?: string,
    limit?: number
  ): Promise<IpcResult<Variant[]>> => {
    return window.electron.invoke(IpcChannel.SEARCH_VARIANTS_FOR_SELECT, { query, parentSku, limit });
  }, []);

  const createVariant = useCallback(async (
    data: CreateVariantData
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.CREATE_VARIANT, data);
  }, []);

  const updateVariant = useCallback(async (
    id: number,
    data: UpdateVariantData
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.UPDATE_VARIANT, { id, data });
  }, []);

  const deleteVariant = useCallback(async (
    id: number
  ): Promise<IpcResult<boolean>> => {
    return window.electron.invoke(IpcChannel.DELETE_VARIANT, { id });
  }, []);

  const updateVariantStock = useCallback(async (
    id: number,
    quantity: number
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.UPDATE_VARIANT_STOCK, { id, quantity });
  }, []);

  const setVariantStock = useCallback(async (
    id: number,
    quantity: number
  ): Promise<IpcResult<Variant>> => {
    return window.electron.invoke(IpcChannel.SET_VARIANT_STOCK, { id, quantity });
  }, []);

  return {
    getVariants,
    getVariantsPaginated,
    getVariant,
    getVariantsByInventory,
    getVariantByBarcode,
    getVariantBySku,
    getActiveVariants,
    getLowStockVariants,
    searchVariantsForSelect,
    createVariant,
    updateVariant,
    deleteVariant,
    updateVariantStock,
    setVariantStock,
  };
}
