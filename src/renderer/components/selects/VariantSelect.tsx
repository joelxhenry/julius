import { useState, useCallback, useEffect } from 'react';
import { Select, Loader, Text, Group, Stack, Badge } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IpcChannel } from '../../../shared/types/ipc';

interface VariantItem {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
  description: string | null;
  quantity: number;
  price: string | null;
  isActive: boolean;
  parentDescription1?: string | null;
}

interface VariantSelectProps {
  value: string | null;
  onChange: (value: string | null, item?: VariantItem) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  parentSku?: string; // Filter by parent SKU
  clearable?: boolean;
}

export function VariantSelect({
  value,
  onChange,
  label = 'Variant',
  placeholder = 'Search by variant SKU or name...',
  required = false,
  error,
  disabled = false,
  parentSku,
  clearable = true,
}: VariantSelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string; item: VariantItem }[]>([]);
  const [itemsMap, setItemsMap] = useState<Map<string, VariantItem>>(new Map());

  const searchVariants = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_VARIANTS_FOR_SELECT, {
        query,
        limit: 20,
      });

      if (result.success && result.data) {
        const newItemsMap = new Map<string, VariantItem>();
        let filteredData = result.data;

        // Filter by parent SKU if provided
        if (parentSku) {
          filteredData = filteredData.filter((item: VariantItem) => item.parentSku === parentSku);
        }

        const newOptions = filteredData.map((item: VariantItem) => {
          newItemsMap.set(item.variantSku, item);
          return {
            value: item.variantSku,
            label: `${item.variantSku} - ${item.variantName || item.description || 'No name'}`,
            item,
          };
        });

        setItemsMap(newItemsMap);
        setOptions(newOptions);
      }
    } catch (err) {
      console.error('Failed to search variants:', err);
    } finally {
      setLoading(false);
    }
  }, [parentSku]);

  useEffect(() => {
    searchVariants(debouncedSearch);
  }, [debouncedSearch, searchVariants]);

  // Load initial value if provided
  useEffect(() => {
    if (value && !itemsMap.has(value)) {
      const loadInitialValue = async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.GET_VARIANT_BY_SKU, { variantSku: value });
          if (result.success && result.data) {
            const item = result.data;
            setItemsMap((prev) => new Map(prev).set(item.variantSku, item));
            setOptions((prev) => {
              if (prev.some((opt) => opt.value === item.variantSku)) return prev;
              return [
                ...prev,
                {
                  value: item.variantSku,
                  label: `${item.variantSku} - ${item.variantName || item.description || 'No name'}`,
                  item,
                },
              ];
            });
          }
        } catch (err) {
          console.error('Failed to load initial variant:', err);
        }
      };
      loadInitialValue();
    }
  }, [value, itemsMap]);

  const handleChange = (selectedValue: string | null) => {
    const selectedItem = selectedValue ? itemsMap.get(selectedValue) : undefined;
    onChange(selectedValue, selectedItem);
  };

  const renderOption = ({ option }: { option: { value: string; label: string; item?: VariantItem } }) => {
    const item = option.item || itemsMap.get(option.value);
    if (!item) {
      return <Text size="sm">{option.label}</Text>;
    }

    return (
      <Stack gap={2}>
        <Group justify="space-between">
          <Text size="sm" fw={500}>{item.variantSku}</Text>
          <Group gap="xs">
            {item.variantType && (
              <Badge size="xs" variant="light">{item.variantType}</Badge>
            )}
            <Text size="xs" c="dimmed">Qty: {item.quantity}</Text>
          </Group>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {item.variantName || item.description || item.parentDescription1 || 'No description'}
        </Text>
      </Stack>
    );
  };

  return (
    <Select
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      data={options}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable={clearable}
      required={required}
      error={error}
      disabled={disabled}
      nothingFoundMessage={
        loading ? 'Searching...' : searchValue.length < 2 ? 'Type at least 2 characters' : 'No variants found'
      }
      rightSection={loading ? <Loader size="xs" /> : undefined}
      renderOption={renderOption}
      filter={() => true}
      maxDropdownHeight={300}
    />
  );
}
