import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Client, InsertClient } from '../../main/database/schema';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENTS, undefined);
      setClients(result.data || result);
    } catch (err) {
      setError(err as Error);
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
      setClients(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
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
    getById,
    findByEmail,
    search,
    create,
    update,
    remove,
  };
}
