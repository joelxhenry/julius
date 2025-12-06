import { useMemo } from 'react';
import { Paper, Stack, Group, Text, Button, ActionIcon } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';

interface InventoryAlternate {
  id: number;
  partNo: string;
  alternateNo: string;
  supplier: string | null;
}

interface AlternatesTabProps {
  alternates: InventoryAlternate[];
  loading: boolean;
  currentSku: string;
  onAddAlternate: () => void;
  onDeleteAlternate: (alternateSku: string) => void;
  onNavigateToAlternate: (alternateSku: string) => void;
}

export function AlternatesTab({
  alternates,
  loading,
  currentSku,
  onAddAlternate,
  onDeleteAlternate,
  onNavigateToAlternate,
}: AlternatesTabProps) {
  const alternatesColumns: Column<InventoryAlternate>[] = useMemo(
    () => [
      {
        key: 'alternateNo',
        header: 'Alternate SKU',
        render: (alt) => {
          const alternateSku = alt.partNo === currentSku ? alt.alternateNo : alt.partNo;
          return (
            <Text
              fw={500}
              c="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateToAlternate(alternateSku)}
            >
              {alternateSku}
            </Text>
          );
        },
      },
      {
        key: 'supplier',
        header: 'Supplier',
        render: (alt) => alt.supplier || '-',
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (alt) => {
          const alternateSku = alt.partNo === currentSku ? alt.alternateNo : alt.partNo;
          return (
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onDeleteAlternate(alternateSku)}
              title="Remove alternate"
            >
              <IconTrash size={16} />
            </ActionIcon>
          );
        },
      },
    ],
    [currentSku, onNavigateToAlternate, onDeleteAlternate]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Alternative Part Numbers</Text>
          <Button leftSection={<IconPlus size={16} />} size="sm" variant="light" onClick={onAddAlternate}>
            Add Alternate
          </Button>
        </Group>
        <DataTable
          columns={alternatesColumns}
          data={alternates}
          loading={loading}
          keyField="id"
          emptyMessage="No alternates found"
          minWidth={400}
          stickyActionsColumn
        />
      </Stack>
    </Paper>
  );
}
