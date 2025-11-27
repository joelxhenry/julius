import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { PaymentMethod, InsertPaymentMethod } from '../../main/database/schema';

export function usePaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENT_METHODS, undefined);
      setPaymentMethods(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActive = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, undefined);
      setPaymentMethods(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertPaymentMethod) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PAYMENT_METHOD, data);
      const newMethod = result.data || result;
      setPaymentMethods((prev) => [...prev, newMethod]);
      return newMethod;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertPaymentMethod>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_PAYMENT_METHOD, { id, data });
      const updated = result.data || result;
      setPaymentMethods((prev) => prev.map((pm) => (pm.id === id ? updated : pm)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_PAYMENT_METHOD, { id });
      setPaymentMethods((prev) => prev.filter((pm) => pm.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    paymentMethods,
    loading,
    error,
    fetchAll,
    fetchActive,
    create,
    update,
    remove,
  };
}
