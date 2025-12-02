import { useState, useEffect, useCallback } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../shared/types/ipc';
import { InventoryWarning } from '../components/invoices';

export interface LineItemWithInventory {
  sku: string | null;
  quantity: number;
}

export function useInventoryCheck(lineItems: LineItemWithInventory[]) {
  const [inventoryWarnings, setInventoryWarnings] = useState<InventoryWarning[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  // Debounced inventory check to avoid too many requests
  const checkInventory = useDebouncedCallback(
    useCallback(async (items: LineItemWithInventory[]) => {
      // Only check items that have SKU and positive quantity
      const itemsToCheck = items.filter(item => item.sku && item.quantity > 0);

      if (itemsToCheck.length === 0) {
        setInventoryWarnings([]);
        return;
      }

      setIsChecking(true);
      try {
        const result = await window.electron.invoke(IpcChannel.CHECK_INVOICE_INVENTORY, {
          lineItems: itemsToCheck,
        });

        if (result.success && result.data) {
          setInventoryWarnings(result.data);
        } else {
          setInventoryWarnings([]);
        }
      } catch (error) {
        console.error('Failed to check inventory:', error);
        setInventoryWarnings([]);
      } finally {
        setIsChecking(false);
      }
    }, []),
    300 // 300ms debounce
  );

  // Check inventory whenever line items change
  useEffect(() => {
    checkInventory(lineItems);
  }, [lineItems, checkInventory]);

  // Helper to get warning for specific SKU
  const getWarningForSku = useCallback(
    (sku: string | null): InventoryWarning | undefined => {
      if (!sku) return undefined;
      return inventoryWarnings.find(w => w.sku === sku);
    },
    [inventoryWarnings]
  );

  // Helper to check if any warnings exist
  const hasWarnings = inventoryWarnings.length > 0;

  // Helper to get summary
  const warningSummary = {
    totalWarnings: inventoryWarnings.length,
    totalWithAlternates: inventoryWarnings.filter(w => w.hasAlternates).length,
    totalWithoutAlternates: inventoryWarnings.filter(w => !w.hasAlternates).length,
  };

  return {
    inventoryWarnings,
    isChecking,
    hasWarnings,
    getWarningForSku,
    warningSummary,
    recheckInventory: () => checkInventory(lineItems),
  };
}
