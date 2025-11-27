import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { PartVariant, InsertPartVariant } from '../../main/database/schema';

export function usePartVariants() {
  const [variants, setVariants] = useState<PartVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART_VARIANTS, undefined);
      setVariants(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByPart = useCallback(async (partId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VARIANTS_BY_PART, { partId });
      setVariants(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActive = useCallback(async (partId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_VARIANTS, partId ? { partId } : undefined);
      setVariants(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLowStock = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_LOW_STOCK_VARIANTS, undefined);
      setVariants(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART_VARIANT, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const create = useCallback(async (data: InsertPartVariant) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PART_VARIANT, data);
      const newVariant = result.data || result;
      setVariants((prev) => [...prev, newVariant]);
      return newVariant;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertPartVariant>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_PART_VARIANT, { id, data });
      const updated = result.data || result;
      setVariants((prev) => prev.map((v) => (v.id === id ? updated : v)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const updateStock = useCallback(async (id: number, quantity: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_VARIANT_STOCK, { id, quantity });
      const updated = result.data || result;
      setVariants((prev) => prev.map((v) => (v.id === id ? updated : v)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_PART_VARIANT, { id });
      setVariants((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    variants,
    loading,
    error,
    fetchAll,
    fetchByPart,
    fetchActive,
    fetchLowStock,
    getById,
    create,
    update,
    updateStock,
    remove,
  };
}
