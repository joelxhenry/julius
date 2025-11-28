import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Invoice, InsertInvoice } from '../../main/database/schema';

interface UseInvoicesOptions {
  includeHistorical?: boolean;
}

export interface InvoiceQueryParams {
  page?: number;
  pageSize?: number;
  includeHistorical?: boolean;
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

export function useInvoices(options: UseInvoicesOptions = {}) {
  const { includeHistorical = false } = options;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper to safely extract array data from API response
  const extractArray = (result: any): Invoice[] => {
    const data = result?.data ?? result;
    return Array.isArray(data) ? data : [];
  };

  const fetchAll = useCallback(async (includeHist: boolean = includeHistorical) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES, { includeHistorical: includeHist });
      setInvoices(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [includeHistorical]);

  const fetchPaginated = useCallback(async (params: InvoiceQueryParams = {}): Promise<PaginatedResult<Invoice>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES_PAGINATED, params);
      if (result.success && result.data) {
        setInvoices(result.data.data);
        return result.data;
      }
      // Fallback for direct data response
      const paginatedData = result.data || result;
      setInvoices(paginatedData.data || []);
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
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES_BY_CLIENT, { clientId });
      setInvoices(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnpaid = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_UNPAID_INVOICES, undefined);
      setInvoices(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICE, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const create = useCallback(async (data: InsertInvoice) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE, data);
      const newInvoice = result.data || result;
      setInvoices((prev) => [...prev, newInvoice]);
      return newInvoice;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertInvoice>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_INVOICE, { id, data });
      const updated = result.data || result;
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const recordPayment = useCallback(async (id: number, amount: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.RECORD_PAYMENT, { id, amount });
      const updated = result.data || result;
      setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_INVOICE, { id });
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll(includeHistorical);
  }, [fetchAll, includeHistorical]);

  return {
    invoices,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    fetchByClient,
    fetchUnpaid,
    getById,
    create,
    update,
    recordPayment,
    remove,
  };
}
