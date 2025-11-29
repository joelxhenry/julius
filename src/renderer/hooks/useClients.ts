import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Client, InsertClient } from '../../main/database/schema';

export interface ClientQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Helper to safely extract array from API response
  const extractArray = (result: any): Client[] => {
    const data = result?.data ?? result;
    return Array.isArray(data) ? data : [];
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENTS, undefined);
      setClients(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPaginated = useCallback(async (params: ClientQueryParams = {}): Promise<PaginatedResult<Client>> => {
    setLoading(true);
    setError(null);
    const emptyResult: PaginatedResult<Client> = { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENTS_PAGINATED, params);
      if (result.success && result.data) {
        const paginatedData = result.data;
        setClients(Array.isArray(paginatedData.data) ? paginatedData.data : []);
        return {
          ...emptyResult,
          ...paginatedData,
          data: Array.isArray(paginatedData.data) ? paginatedData.data : [],
        };
      }
      return emptyResult;
    } catch (err) {
      setError(err as Error);
      return emptyResult;
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENT, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const findByEmail = useCallback(async (email: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENT_BY_EMAIL, { email });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_CLIENTS, { query });
      setClients(extractArray(result));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const searchForSelect = useCallback(async (query: string, limit: number = 20): Promise<Client[]> => {
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_CLIENTS_FOR_SELECT, { query, limit });
      const data = result.data || result;
      return Array.isArray(data) ? data : [];
    } catch (err) {
      setError(err as Error);
      return [];
    }
  }, []);

  const create = useCallback(async (data: InsertClient) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_CLIENT, data);
      const newClient = result.data || result;
      setClients((prev) => [...prev, newClient]);
      return newClient;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertClient>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_CLIENT, { id, data });
      const updated = result.data || result;
      setClients((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_CLIENT, { id });
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    clients,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    getById,
    findByEmail,
    search,
    searchForSelect,
    create,
    update,
    remove,
  };
}
