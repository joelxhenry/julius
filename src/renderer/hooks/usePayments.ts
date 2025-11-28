import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Payment, InsertPayment } from '../../main/database/schema';

export interface PaymentQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  method?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper to safely extract array data from API response
  const extractArray = (result: any): Payment[] => {
    const data = result?.data ?? result;
    return Array.isArray(data) ? data : [];
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS, undefined);
      setPayments(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPaginated = useCallback(async (params: PaymentQueryParams = {}): Promise<PaginatedResult<Payment>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, params);
      if (result.success && result.data) {
        setPayments(result.data.data);
        return result.data;
      }
      const paginatedData = result.data || result;
      setPayments(paginatedData.data || []);
      return paginatedData;
    } catch (err) {
      setError(err as Error);
      return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByInvoice = useCallback(async (invoiceId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_BY_INVOICE, { invoiceId });
      setPayments(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENT, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const create = useCallback(async (data: InsertPayment) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PAYMENT, data);
      const newPayment = result.data || result;
      setPayments((prev) => [...prev, newPayment]);
      return newPayment;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertPayment>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_PAYMENT, { id, data });
      const updated = result.data || result;
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_PAYMENT, { id });
      setPayments((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    payments,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    fetchByInvoice,
    getById,
    create,
    update,
    remove,
  };
}
