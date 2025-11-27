import { useState, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { InvoiceItem, InsertInvoiceItem } from '../../main/database/schema';

export function useInvoiceItems(invoiceId?: number) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchByInvoice = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICE_ITEMS, { invoiceId: id });
      setItems(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertInvoiceItem) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_ITEM, data);
      const newItem = result.data || result;
      setItems((prev) => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const createBulk = useCallback(async (itemsData: InsertInvoiceItem[]) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_ITEMS_BULK, itemsData);
      const newItems = result.data || result;
      setItems((prev) => [...prev, ...newItems]);
      return newItems;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertInvoiceItem>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_INVOICE_ITEM, { id, data });
      const updated = result.data || result;
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_INVOICE_ITEM, { id });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    items,
    loading,
    error,
    fetchByInvoice,
    create,
    createBulk,
    update,
    remove,
  };
}
