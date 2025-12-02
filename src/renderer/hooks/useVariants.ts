import { useState, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { Variant } from '../components/invoices';

export function useVariants() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHasVariants = useCallback(async (parentSku: string): Promise<boolean> => {
    try {
      const result = await window.electron.invoke(IpcChannel.CHECK_HAS_VARIANTS, {
        parentSku,
      });

      if (result.success && result.data) {
        return result.data.hasVariants;
      }
      return false;
    } catch (err) {
      console.error('Failed to check if SKU has variants:', err);
      return false;
    }
  }, []);

  const loadVariants = useCallback(async (parentSku: string) => {
    setIsLoading(true);
    setError(null);
    setVariants([]);

    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_VARIANTS, {
        parentSku,
      });

      if (result.success && result.data) {
        setVariants(result.data);
      } else {
        setError(result.error || 'Failed to load variants');
      }
    } catch (err) {
      console.error('Failed to load variants:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearVariants = useCallback(() => {
    setVariants([]);
    setError(null);
  }, []);

  return {
    variants,
    isLoading,
    error,
    checkHasVariants,
    loadVariants,
    clearVariants,
  };
}
