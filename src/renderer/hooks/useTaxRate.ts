import { useState, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { DEFAULT_TAX_RATE } from '../../shared/types/inventory';

interface UseTaxRateResult {
  taxRate: number;
  taxRatePercent: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage the tax rate from system settings
 * Returns the tax rate as a decimal (e.g., 0.15 for 15%)
 */
export function useTaxRate(): UseTaxRateResult {
  const [taxRate, setTaxRate] = useState<number>(DEFAULT_TAX_RATE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTaxRate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_TAX_RATE);
      if (result.success && result.data?.taxRate !== undefined) {
        setTaxRate(result.data.taxRate);
      } else {
        // Use default if not found
        setTaxRate(DEFAULT_TAX_RATE);
      }
    } catch (err) {
      console.error('Failed to load tax rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tax rate');
      // Keep default tax rate on error
      setTaxRate(DEFAULT_TAX_RATE);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxRate();
  }, []);

  return {
    taxRate,
    taxRatePercent: taxRate * 100,
    isLoading,
    error,
    refetch: fetchTaxRate,
  };
}
