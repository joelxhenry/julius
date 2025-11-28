import { Title, Group, Button, Modal, Stack, Badge, Select } from '@mantine/core';
import { useState, useMemo } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { PartForm } from '../../components/forms/PartForm';
import { useParts, usePartVariants } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Part } from '../../../main/database/schema';
import { PartFormData } from '../../utils/schemas';

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
  const { parts, loading, create } = useParts();
  const { variants } = usePartVariants();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stockFilter, setStockFilter] = useState<StockStatus>('all');

  // Calculate stock status for each part based on its variants
  const partsWithStock = useMemo((): PartWithStock[] => {
    return parts.map((part) => {
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
  }, [parts, variants]);

  // Filter parts based on stock status
  const filteredParts = useMemo(() => {
    if (stockFilter === 'all') {
      return partsWithStock;
    }
    return partsWithStock.filter((part) => part.stockStatus === stockFilter);
  }, [partsWithStock, stockFilter]);

  const columns: ColumnDef<PartWithStock>[] = [
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
  ];

  const handleCreate = async (data: PartFormData) => {
    setIsCreating(true);
    try {
      await create({
        ...data,
        price: data.price?.toString(),
      });
      setCreateModalOpened(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Parts Inventory</Title>
        <Group>
          <Select
            placeholder="Filter by status"
            data={stockStatusOptions}
            value={stockFilter}
            onChange={(value) => setStockFilter((value as StockStatus) || 'all')}
            w={160}
            size="sm"
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateModalOpened(true)}
          >
            New Part
          </Button>
        </Group>
      </Group>

      <DataTable
        data={filteredParts}
        columns={columns}
        loading={loading}
        onRowClick={(part: PartWithStock, options?: RowClickOptions) => {
          openTab({
            type: 'part-detail',
            path: `/inventory/parts/${part.id}`,
            title: part.name || `Part #${part.id}`,
            entityId: part.id.toString(),
          }, options?.newTab);
        }}
        searchable
        pagination
        keyboardNav
      />

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
