import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Part, InsertPart } from '../../main/database/schema';

export function useParts() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PARTS, undefined);
      setParts(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const findBySku = useCallback(async (sku: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART_BY_SKU, { sku });
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
      const result = await window.electron.invoke(IpcChannel.SEARCH_PARTS, { query });
      setParts(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertPart) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PART, data);
      const newPart = result.data || result;
      setParts((prev) => [...prev, newPart]);
      return newPart;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertPart>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_PART, { id, data });
      const updated = result.data || result;
      setParts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_PART, { id });
      setParts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    parts,
    loading,
    error,
    fetchAll,
    getById,
    findBySku,
    search,
    create,
    update,
    remove,
  };
}
