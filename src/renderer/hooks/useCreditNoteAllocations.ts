import { useState, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { CreditNoteAllocation, InsertCreditNoteAllocation } from '../../main/database/schema';

export function useCreditNoteAllocations(creditNoteId?: number) {
  const [allocations, setAllocations] = useState<CreditNoteAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchByCreditNote = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE_ALLOCATIONS, { creditNoteId: id });
      setAllocations(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertCreditNoteAllocation) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_CREDIT_NOTE_ALLOCATION, data);
      const newAllocation = result.data || result;
      setAllocations((prev) => [...prev, newAllocation]);
      return newAllocation;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertCreditNoteAllocation>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_CREDIT_NOTE_ALLOCATION, { id, data });
      const updated = result.data || result;
      setAllocations((prev) => prev.map((alloc) => (alloc.id === id ? updated : alloc)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_CREDIT_NOTE_ALLOCATION, { id });
      setAllocations((prev) => prev.filter((alloc) => alloc.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    allocations,
    loading,
    error,
    fetchByCreditNote,
    create,
    update,
    remove,
  };
}
