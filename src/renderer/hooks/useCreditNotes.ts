import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { CreditNote, InsertCreditNote } from '../../main/database/schema';

export interface CreditNoteQueryParams {
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

export function useCreditNotes() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES, undefined);
      setCreditNotes(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPaginated = useCallback(async (params: CreditNoteQueryParams = {}): Promise<PaginatedResult<CreditNote>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_PAGINATED, params);
      if (result.success && result.data) {
        setCreditNotes(result.data.data);
        return result.data;
      }
      const paginatedData = result.data || result;
      setCreditNotes(paginatedData.data || []);
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
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_BY_CLIENT, { clientId });
      setCreditNotes(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnallocated = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_UNALLOCATED_CREDIT_NOTES, undefined);
      setCreditNotes(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const create = useCallback(async (data: InsertCreditNote) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_CREDIT_NOTE, data);
      const newCreditNote = result.data || result;
      setCreditNotes((prev) => [...prev, newCreditNote]);
      return newCreditNote;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertCreditNote>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_CREDIT_NOTE, { id, data });
      const updated = result.data || result;
      setCreditNotes((prev) => prev.map((cn) => (cn.id === id ? updated : cn)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_CREDIT_NOTE, { id });
      setCreditNotes((prev) => prev.filter((cn) => cn.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    creditNotes,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    fetchByClient,
    fetchUnallocated,
    getById,
    create,
    update,
    remove,
  };
}
