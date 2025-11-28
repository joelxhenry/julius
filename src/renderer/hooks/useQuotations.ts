import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Quotation, InsertQuotation } from '../../main/database/schema';

export interface QuotationQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS, undefined);
      setQuotations(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPaginated = useCallback(async (params: QuotationQueryParams = {}): Promise<PaginatedResult<Quotation>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_PAGINATED, params);
      if (result.success && result.data) {
        setQuotations(result.data.data);
        return result.data;
      }
      const paginatedData = result.data || result;
      setQuotations(paginatedData.data || []);
      return paginatedData;
    } catch (err) {
      setError(err as Error);
      return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByClient = useCallback(async (clientId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_BY_CLIENT, { clientId });
      setQuotations(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const create = useCallback(async (data: InsertQuotation) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_QUOTATION, data);
      const newQuotation = result.data || result;
      setQuotations((prev) => [...prev, newQuotation]);
      return newQuotation;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertQuotation>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_QUOTATION, { id, data });
      const updated = result.data || result;
      setQuotations((prev) => prev.map((q) => (q.id === id ? updated : q)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const convertToInvoice = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CONVERT_QUOTATION_TO_INVOICE, { id });
      const updated = result.data || result;
      setQuotations((prev) => prev.map((q) => (q.id === id ? updated : q)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_QUOTATION, { id });
      setQuotations((prev) => prev.filter((q) => q.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    quotations,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    fetchByClient,
    getById,
    create,
    update,
    convertToInvoice,
    remove,
  };
}
