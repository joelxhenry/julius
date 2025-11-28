import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { User, InsertUser } from '../../main/database/schema';

// Type for creating users without requiring pinHash (backend will set default)
type CreateUserData = Omit<InsertUser, 'pinHash'> & { pinHash?: string };

export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  activeOnly?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USERS, undefined);
      setUsers(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPaginated = useCallback(async (params: UserQueryParams = {}): Promise<PaginatedResult<User>> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USERS_PAGINATED, params);
      if (result.success && result.data) {
        setUsers(result.data.data);
        return result.data;
      }
      const paginatedData = result.data || result;
      setUsers(paginatedData.data || []);
      return paginatedData;
    } catch (err) {
      setError(err as Error);
      return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_USERS, undefined);
      setUsers(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USER, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const findByUsername = useCallback(async (username: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USER_BY_USERNAME, { username });
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
      const result = await window.electron.invoke(IpcChannel.SEARCH_USERS, { query });
      setUsers(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: CreateUserData) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_USER, data);
      const newUser = result.data || result;
      setUsers((prev) => [...prev, newUser]);
      return newUser;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<CreateUserData>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_USER, { id, data });
      const updated = result.data || result;
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_USER, { id });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    users,
    loading,
    error,
    fetchAll,
    fetchPaginated,
    fetchActive,
    getById,
    findByUsername,
    search,
    create,
    update,
    remove,
  };
}
