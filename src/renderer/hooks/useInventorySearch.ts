import { useState, useCallback } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../shared/types/ipc';

export interface InventorySearchItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string | null;
  cost: string | null;
  quantity: number;
  isTaxable: boolean;
  isVariant: boolean;
  isBase?: boolean; // True if this is a base variant
  parentSku: string | null;
  variantName: string | null;
}

export interface InventoryOption {
  value: string;
  label: string;
  item: InventorySearchItem;
}

interface UseInventorySearchOptions {
  onSelect?: (item: InventorySearchItem) => void;
  limit?: number;
}

export function useInventorySearch(config: UseInventorySearchOptions = {}) {
  const { onSelect, limit = 15 } = config;

  const [search, setSearch] = useState('');
  const [itemOptions, setItemOptions] = useState<InventoryOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchItems = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setItemOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_INVENTORY_WITH_VARIANTS, { query, limit });
      if (result.success && result.data) {
        setItemOptions(
          result.data.map((item: InventorySearchItem) => {
            let label: string;
            if (item.isBase) {
              // Base variant - show as regular item (no prefix)
              label = `${item.sku}    —    ${item.description1 || item.variantName || 'No description'}`;
            } else {
              // Non-base variant - show variant indicator
              label = `[V] ${item.sku}    —    ${item.variantName || item.description1 || 'No name'}`;
            }
            return { value: item.sku, label, item };
          })
        );
      }
    } catch (error) {
      console.error('Failed to search items:', error);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  const handleSelect = useCallback(
    (value: string) => {
      const option = itemOptions.find((o) => o.value === value);
      if (option) {
        onSelect?.(option.item);
        // Clear search after selection
        setSearch('');
        setItemOptions([]);
      }
    },
    [itemOptions, onSelect]
  );

  const clearSearch = useCallback(() => {
    setSearch('');
    setItemOptions([]);
  }, []);

  return {
    search,
    setSearch,
    options: itemOptions,
    isSearching,
    searchItems,
    handleSelect,
    clearSearch,
  };
}
