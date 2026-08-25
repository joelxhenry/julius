import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Autocomplete,
  Badge,
  ActionIcon,
  Text,
  NumberFormatter,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconAlertTriangle,
  IconCategory,
  IconCar,
} from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column, CopyButton } from '../../components/common';
import { MarkButton } from '../../components/tray/MarkButton';
import { normalizeToArray } from '../../../shared/utils/arrayFields';

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  minLevel: number;
  isTaxable: boolean;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  margin: string | null;
  unit: string;
  category: string | null;
  model: string | null;
  wholesalePrice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginatedResult {
  data: Inventory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function InventoryListPage() {
  const { replaceCurrentTab } = useTabContext();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [debouncedCategory] = useDebouncedValue(categoryFilter, 500);
  const [debouncedModel] = useDebouncedValue(modelFilter, 500);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  const pageSize = 20;

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
        category: debouncedCategory,
        model: debouncedModel,
      });

      console.log('Inventory fetch result:', result);

      if (result.success && result.data) {
        const paginatedResult = result.data as PaginatedResult;
        setInventory(paginatedResult.data);
        setTotal(paginatedResult.total);
        setTotalPages(paginatedResult.totalPages);
      } else if (!result.success) {
        console.error('Inventory fetch failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, debouncedCategory, debouncedModel]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedCategory, debouncedModel]);

  // Load distinct categories/models for autocomplete suggestions
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [catResult, modelResult] = await Promise.all([
        window.electron.invoke(IpcChannel.GET_DISTINCT_CATEGORIES, { limit: 200 }),
        window.electron.invoke(IpcChannel.GET_DISTINCT_MODELS, { limit: 200 }),
      ]);
      if (cancelled) return;
      if (catResult?.success && Array.isArray(catResult.data)) {
        setCategoryOptions(catResult.data);
      }
      if (modelResult?.success && Array.isArray(modelResult.data)) {
        setModelOptions(modelResult.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isLowStock = (item: Inventory) => {
    return item.quantity <= item.minLevel;
  };

  const columns: Column<Inventory>[] = useMemo(
    () => [
      {
        key: 'sku',
        header: 'Part Number',
        width: 280,
        render: (item) => (
          <Group gap="xs">
            <Text fw={500} size="sm">{item.sku}</Text>
            <CopyButton value={item.sku} />
            {isLowStock(item) && (
              <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
            )}
          </Group>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (item) => (
          <Stack gap={0}>
            <Text size="sm" lineClamp={1}>{item.description1 || '-'}</Text>
            {item.description2 && (
              <Text size="xs" c="dimmed" lineClamp={1}>{item.description2}</Text>
            )}
          </Stack>
        ),
      },
      {
        key: 'category',
        header: 'Category/Model',
        width: 560,
        render: (item) => {
          const categories = normalizeToArray(item.category);
          const models = normalizeToArray(item.model);
          if (categories.length === 0 && models.length === 0) {
            return <Text size="sm" c="dimmed">-</Text>;
          }
          return (
            <Group gap={6} wrap="wrap">
              {categories.map((cat, idx) => (
                <Badge key={`c-${idx}`} variant="filled" size="md" radius="sm">
                  {cat}
                </Badge>
              ))}
              {models.map((model, idx) => (
                <Badge
                  key={`m-${idx}`}
                  variant="outline"
                  size="md"
                  radius="sm"
                  color="gray"
                >
                  {model}
                </Badge>
              ))}
            </Group>
          );
        },
      },
      {
        key: 'quantity',
        header: 'Stock',
        width: 100,
        render: (item) => (
          <Badge
            color={isLowStock(item) ? 'orange' : 'green'}
            variant="light"
            size="sm"
          >
            {item.quantity} {item.unit}
          </Badge>
        ),
      },
      {
        key: 'price',
        header: 'Price',
        width: 100,
        render: (item) => (
          <Text size="sm" fw={500}>
            <NumberFormatter
              value={item.price}
              prefix="$"
              thousandSeparator
              decimalScale={2}
            />
          </Text>
        ),
      },
      {
        key: 'mark',
        header: '',
        width: 48,
        render: (item) => <MarkButton mode="item" parentSku={item.sku} />,
      },
    ],
    []
  );

  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Inventory</Title>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          {/* Filters */}
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              placeholder="Search by part number, description, model..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 2, minWidth: 240 }}
            />
            <Autocomplete
              placeholder="Filter by category"
              leftSection={<IconCategory size={16} />}
              value={categoryFilter}
              onChange={setCategoryFilter}
              data={categoryOptions}
              limit={20}
              clearable
              style={{ flex: 1, minWidth: 180 }}
            />
            <Autocomplete
              placeholder="Filter by model"
              leftSection={<IconCar size={16} />}
              value={modelFilter}
              onChange={setModelFilter}
              data={modelOptions}
              limit={20}
              clearable
              style={{ flex: 1, minWidth: 180 }}
            />
            <ActionIcon variant="subtle" onClick={fetchInventory} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Results count */}
          <Text size="sm" c="dimmed">
            {total} item{total !== 1 ? 's' : ''} found
          </Text>

          {/* Table */}
          <DataTable
            columns={columns}
            data={inventory}
            loading={loading}
            keyField="id"
            onRowClick={(item) => replaceCurrentTab(`/inventory/${item.id}`)}
            emptyMessage="No inventory items found"
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            skeletonRows={5}
            minWidth={1000}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
