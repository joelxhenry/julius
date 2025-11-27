import { Title, Group, Button, Modal, Stack, Badge } from '@mantine/core';
import { useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { PartForm } from '../../components/forms/PartForm';
import { useParts } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Part } from '../../../main/database/schema';
import { PartFormData } from '../../utils/schemas';

export function PartsListPage() {
  const { openTab } = useTabManager();
  const { parts, loading, create } = useParts();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const columns: ColumnDef<Part>[] = [
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
      key: 'taxable',
      title: 'Taxable',
      render: (value) => (
        <Badge color={value ? 'green' : 'gray'} size="sm">
          {value ? 'Yes' : 'No'}
        </Badge>
      ),
    },
  ];

  const handleCreate = async (data: PartFormData) => {
    setIsCreating(true);
    try {
      await create(data);
      setCreateModalOpened(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Parts Inventory</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          New Part
        </Button>
      </Group>

      <DataTable
        data={parts}
        columns={columns}
        loading={loading}
        onRowClick={(part: Part, options?: RowClickOptions) => {
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
