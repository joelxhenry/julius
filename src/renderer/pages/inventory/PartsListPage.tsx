import { Title, Group, Button, Modal, Stack, Badge, Select, TextInput, Text, Pagination } from '@mantine/core';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch, IconPackage } from '@tabler/icons-react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { PartForm } from '../../components/forms/PartForm';
import { useParts, usePartVariants, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Part } from '../../../main/database/schema';
import { PartFormData } from '../../utils/schemas';

const PAGE_SIZE = 50;

type StockStatus = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

const stockStatusOptions = [
  { value: 'all', label: 'All Items' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];

interface PartWithStock extends Part {
  totalStock: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
}

export function PartsListPage() {
  const { openTab } = useTabManager();
  const { fetchPaginated, loading, create } = useParts();
  const { variants } = usePartVariants();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Part>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Fetch data when page or search changes
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, debouncedSearch, fetchPaginated]);

  // Calculate stock status for each part based on its variants
  const partsWithStock = useMemo((): PartWithStock[] => {
    return paginatedData.data.map((part) => {
      const partVariants = variants.filter((v) => v.partId === part.id);
      const totalStock = partVariants.reduce((sum, v) => sum + (v.stockQty || 0), 0);
      const hasLowStock = partVariants.some((v) => v.stockQty <= v.reorderLevel && v.stockQty > 0);
      const isOutOfStock = totalStock === 0 && partVariants.length > 0;

      let stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
      if (isOutOfStock) {
        stockStatus = 'out-of-stock';
      } else if (hasLowStock) {
        stockStatus = 'low-stock';
      } else {
        stockStatus = 'in-stock';
      }

      return {
        ...part,
        totalStock,
        stockStatus,
      };
    });
  }, [paginatedData.data, variants]);

  // Filter parts based on stock status (client-side filtering for stock status)
  const filteredParts = useMemo(() => {
    if (stockFilter === 'all') {
      return partsWithStock;
    }
    return partsWithStock.filter((part) => part.stockStatus === stockFilter);
  }, [partsWithStock, stockFilter]);

  const columns: ColumnDef<PartWithStock>[] = useMemo(() => [
    { key: 'id', title: 'ID', sortable: true, width: 80 },
    { key: 'sku', title: 'SKU', sortable: true },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'category', title: 'Category', sortable: true },
    {
      key: 'price',
      title: 'Price',
      sortable: true,
      render: (value) => `$${(value || 0)}`,
    },
    {
      key: 'stockStatus',
      title: 'Status',
      render: (value) => {
        const statusConfig = {
          'in-stock': { color: 'green', label: 'In Stock' },
          'low-stock': { color: 'orange', label: 'Low Stock' },
          'out-of-stock': { color: 'red', label: 'Out of Stock' },
        };
        const config = statusConfig[value as keyof typeof statusConfig] || statusConfig['in-stock'];
        return (
          <Badge color={config.color} size="sm">
            {config.label}
          </Badge>
        );
      },
    }
  ], []);

  const handleRowClick = useCallback(
    (part: PartWithStock, options?: RowClickOptions) => {
      openTab(
        {
          type: 'part-detail',
          path: `/inventory/parts/${part.id}`,
          title: part.name || `Part #${part.id}`,
          entityId: part.id.toString(),
        },
        options?.newTab
      );
    },
    [openTab]
  );

  const handleCreate = async (data: PartFormData) => {
    setIsCreating(true);
    try {
      await create({
        ...data,
        price: data.price?.toString(),
      });
      setCreateModalOpened(false);
      // Refresh data after create
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setPaginatedData(result);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconPackage size={32} />
          <Title order={2}>Parts Inventory</Title>
        </Group>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpened(true)}
          >
            New Part
          </Button>
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name, SKU, description..."
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by status"
          data={stockStatusOptions}
          value={stockFilter}
          onChange={(value) => setStockFilter((value as StockStatus) || 'all')}
          w={160}
          clearable={false}
        />
        <Text size="sm" c="dimmed">
          {paginatedData.total} part{paginatedData.total !== 1 ? 's' : ''}
        </Text>
      </Group>

      <DataTable
        data={filteredParts}
        columns={columns}
        loading={loading}
        onRowClick={handleRowClick}
        rowKey="id"
      />

      {paginatedData.totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={paginatedData.totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}

      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Create New Part"
        size="lg"
      >
        <PartForm
          onSubmit={handleCreate}
          onCancel={() => setCreateModalOpened(false)}
          loading={isCreating}
        />
      </Modal>
    </Stack>
  );
}
