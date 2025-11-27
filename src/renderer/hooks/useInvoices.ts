import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Invoice, InsertInvoice } from '../../main/database/schema';

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES, undefined);
      setInvoices(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByClient = useCallback(async (clientId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES_BY_CLIENT, { clientId });
      setInvoices(result.data || result);
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
      setInvoices(result.data || result);
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
    fetchAll();
  }, [fetchAll]);

  return {
    invoices,
    loading,
    error,
    fetchAll,
    fetchByClient,
    fetchUnpaid,
    getById,
    create,
    update,
    recordPayment,
    remove,
  };
}
