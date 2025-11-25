import { useState, useEffect, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { User, InsertUser, Note, InsertNote } from '../../main/database/schema';

// User operations hook
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USERS, undefined);
      setUsers(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (data: InsertUser) => {
    try {
      const newUser = await window.electron.invoke(IpcChannel.CREATE_USER, data);
      setUsers((prev) => [...prev, newUser]);
      return newUser;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const deleteUser = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_USER, { id });
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, fetchUsers, createUser, deleteUser };
}

// Notes operations hook
export function useNotes(userId?: number) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_NOTES, { userId });
      setNotes(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createNote = useCallback(async (data: InsertNote) => {
    try {
      const newNote = await window.electron.invoke(IpcChannel.CREATE_NOTE, data);
      setNotes((prev) => [...prev, newNote]);
      return newNote;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const updateNote = useCallback(async (id: number, data: Partial<InsertNote>) => {
    try {
      const updatedNote = await window.electron.invoke(IpcChannel.UPDATE_NOTE, {
        id,
        data,
      });
      setNotes((prev) => prev.map((n) => (n.id === id ? updatedNote : n)));
      return updatedNote;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const deleteNote = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_NOTE, { id });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    error,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}
