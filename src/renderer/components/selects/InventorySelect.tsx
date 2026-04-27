import { useState, useCallback, useEffect, useRef } from 'react';
import { Select, Loader, Text, Group, Stack } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../../shared/types/ipc';

interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  category: string | null;
  quantity: number;
  price: string;
}

interface SelectOption {
  value: string;
  label: string;
  item: InventoryItem;
}

interface InventorySelectProps {
  value: string | null;
  onChange: (value: string | null, item?: InventoryItem) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  excludeSku?: string;
  clearable?: boolean;
}

export function InventorySelect({
  value,
  onChange,
  label = 'Inventory Item',
  placeholder = 'Search by part number or description...',
  required = false,
  error,
  disabled = false,
  excludeSku,
  clearable = true,
}: InventorySelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const itemsMapRef = useRef<Map<string, InventoryItem>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchInventory = useCallback(async (query: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!query || query.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_INVENTORY_FOR_SELECT, {
        query,
        limit: 15,
      });

      if (result.success && result.data) {
        const newOptions: SelectOption[] = [];

        for (const item of (result.data ?? [])) {
          if (item.sku !== excludeSku) {
            itemsMapRef.current.set(item.sku, item);
            newOptions.push({
              value: item.sku,
              label: `${item.sku} - ${item.description1 || 'No description'}`,
              item,
            });
          }
        }

        setOptions(newOptions);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to search inventory:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [excludeSku]);

  // Debounced search - 400ms delay for better UX
  const debouncedSearch = useDebouncedCallback(searchInventory, 400);

  const handleSearchChange = useCallback((query: string) => {
    setSearchValue(query);
    if (query.length >= 2) {
      setLoading(true);
    }
    debouncedSearch(query);
  }, [debouncedSearch]);

  // Load initial value if provided
  useEffect(() => {
    if (value && !itemsMapRef.current.has(value)) {
      const loadInitialValue = async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku: value });
          if (result.success && result.data) {
            const item = result.data;
            itemsMapRef.current.set(item.sku, item);
            setOptions(prev => {
              if (prev.some(opt => opt.value === item.sku)) return prev;
              return [...prev, {
                value: item.sku,
                label: `${item.sku} - ${item.description1 || 'No description'}`,
                item,
              }];
            });
          }
        } catch (err) {
          console.error('Failed to load initial inventory item:', err);
        }
      };
      loadInitialValue();
    }
  }, [value]);

  const handleChange = useCallback((selectedValue: string | null) => {
    const selectedItem = selectedValue ? itemsMapRef.current.get(selectedValue) : undefined;
    onChange(selectedValue, selectedItem);
  }, [onChange]);

  const renderOption = useCallback(({ option }: { option: SelectOption }) => {
    const item = option.item || itemsMapRef.current.get(option.value);
    if (!item) {
      return <Text size="sm">{option.label}</Text>;
    }

    return (
      <Stack gap={2}>
        <Group justify="space-between">
          <Text size="sm" fw={500}>{item.sku}</Text>
          <Text size="xs" c="dimmed">Qty: {item.quantity}</Text>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {item.description1 || 'No description'}
        </Text>
      </Stack>
    );
  }, []);

  const nothingFoundMessage = loading
    ? 'Searching...'
    : searchValue.length < 2
      ? 'Type at least 2 characters'
      : 'No items found';

  return (
    <Select
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      data={options}
      searchable
      searchValue={searchValue}
      onSearchChange={handleSearchChange}
      clearable={clearable}
      required={required}
      error={error}
      disabled={disabled}
      nothingFoundMessage={nothingFoundMessage}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      renderOption={renderOption}
      maxDropdownHeight={280}
    />
  );
}
