import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Loader,
  Center,
  Checkbox,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconAlertTriangle,
  IconCategory,
  IconCar,
  IconPlus,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { DataTable, Column, CopyButton } from '../../components/common';
import { MarkButton } from '../../components/tray/MarkButton';
import { AddToListButton } from '../../components/lists';
import { normalizeToArray } from '../../../shared/utils/arrayFields';
import { NewPartModal } from './NewPartModal';
import { PermissionButton } from '../../permissions';
import { useListState, useRestoreGuard, wasPersisted } from '../../hooks/useListState';

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  totalStock: number;
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
  isActive: boolean;
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
  const [newPartOpened, { open: openNewPart, close: closeNewPart }] = useDisclosure(false);
  const [loading, setLoading] = useState(() => !wasPersisted('inventory:inventory'));
  const [loadingMore, setLoadingMore] = useState(false);
  const [inventory, setInventory] = useListState<Inventory[]>('inventory:inventory', []);
  const [total, setTotal] = useListState('inventory:total', 0);
  const [page, setPage] = useListState('inventory:page', 1);
  const [hasMore, setHasMore] = useListState('inventory:hasMore', true);
  const [search, setSearch] = useListState('inventory:search', '');
  const [categoryFilter, setCategoryFilter] = useListState('inventory:categoryFilter', '');
  const [modelFilter, setModelFilter] = useListState('inventory:modelFilter', '');
  const [debouncedSearch] = useDebouncedValue(search, 500);
  const [debouncedCategory] = useDebouncedValue(categoryFilter, 500);
  const [debouncedModel] = useDebouncedValue(modelFilter, 500);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useListState('inventory:showArchived', false);
  const skipInitialFetch = useRestoreGuard('inventory:inventory');

  const pageSize = 30;

  // Fetches a single page of results. When `append` is true, the results are
  // added to the existing list (infinite scroll); otherwise they replace it.
  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_PAGINATED, {
          page: pageNum,
          pageSize,
          search: debouncedSearch,
          category: debouncedCategory,
          model: debouncedModel,
          includeArchived: showArchived,
        });

        if (result.success && result.data) {
          const paginatedResult = result.data as PaginatedResult;
          setInventory((prev) =>
            append ? [...prev, ...paginatedResult.data] : paginatedResult.data
          );
          setTotal(paginatedResult.total);
          setHasMore(pageNum < paginatedResult.totalPages);
          setPage(pageNum);
        } else if (!result.success) {
          console.error('Inventory fetch failed:', result.error);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [pageSize, debouncedSearch, debouncedCategory, debouncedModel, showArchived, setInventory, setTotal, setHasMore, setPage]
  );

  // Reload from page 1 whenever the search/filters change
  useEffect(() => {
    if (skipInitialFetch()) return;
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedCategory, debouncedModel, showArchived, skipInitialFetch]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    fetchPage(page + 1, true);
  }, [loading, loadingMore, hasMore, page, fetchPage]);

  // Infinite scroll: observe a sentinel element below the table and load the
  // next page once it scrolls into view, instead of numbered pagination.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

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
    return item.totalStock <= item.minLevel;
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
            {!item.isActive && (
              <Badge color="gray" variant="light" size="xs">
                Archived
              </Badge>
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
        header: 'Vehicle/Model',
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
            {item.totalStock} {item.unit}
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
        width: 84,
        render: (item) => (
          <Group gap={4} wrap="nowrap">
            <MarkButton mode="item" parentSku={item.sku} />
            <AddToListButton mode="item" parentSku={item.sku} />
          </Group>
        ),
      },
    ],
    []
  );

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Inventory</Title>
        <PermissionButton
          permission="CREATE_INVENTORY"
          whenDenied="disable"
          leftSection={<IconPlus size={16} />}
          onClick={openNewPart}
        >
          Add Part
        </PermissionButton>
      </Group>

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
              placeholder="Filter by vehicle"
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
            <Checkbox
              label="Show archived"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.currentTarget.checked)}
            />
            <ActionIcon variant="subtle" onClick={() => fetchPage(1, false)} title="Refresh">
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
            getRowPath={(item) => `/inventory/${item.id}`}
            emptyMessage="No inventory items found"
            skeletonRows={5}
            minWidth={1000}
          />

          {/* Infinite scroll sentinel */}
          {!loading && hasMore && (
            <Center ref={sentinelRef} py="md">
              {loadingMore && <Loader size="sm" />}
            </Center>
          )}
          {!loading && !hasMore && inventory.length > 0 && (
            <Center py="md">
              <Text size="xs" c="dimmed">
                All {total} items loaded
              </Text>
            </Center>
          )}
        </Stack>
      </Paper>

      <NewPartModal
        opened={newPartOpened}
        onClose={closeNewPart}
        onCreated={() => fetchPage(1, false)}
      />
    </Stack>
  );
}
