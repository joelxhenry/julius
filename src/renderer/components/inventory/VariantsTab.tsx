import { useMemo } from 'react';
import { Paper, Stack, Group, Text, Button, Badge, ActionIcon, Menu, NumberFormatter } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconDotsVertical } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
}

interface VariantsTabProps {
  variants: Variant[];
  loading: boolean;
  onAddVariant: () => void;
  onEditVariant: (variant: Variant) => void;
  onDeleteVariant: (variantId: number) => void;
}

export function VariantsTab({ variants, loading, onAddVariant, onEditVariant, onDeleteVariant }: VariantsTabProps) {
  const variantsColumns: Column<Variant>[] = useMemo(
    () => [
      {
        key: 'variantSku',
        header: 'Variant SKU',
        width: 150,
        render: (variant) => <Text fw={500}>{variant.variantSku}</Text>,
      },
      {
        key: 'variantName',
        header: 'Name',
        render: (variant) => variant.variantName || '-',
      },
      {
        key: 'variantType',
        header: 'Type',
        width: 120,
        render: (variant) =>
          variant.variantType ? <Badge variant="light" size="sm">{variant.variantType}</Badge> : null,
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: 100,
        accessor: 'quantity',
      },
      {
        key: 'price',
        header: 'Price',
        width: 120,
        render: (variant) =>
          variant.price ? <NumberFormatter value={variant.price} prefix="$" thousandSeparator decimalScale={2} /> : '-',
      },
      {
        key: 'status',
        header: 'Status',
        width: 100,
        render: (variant) => (
          <Badge color={variant.isActive ? 'green' : 'gray'} variant="light" size="sm">
            {variant.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (variant) => (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEditVariant(variant)}>
                Edit
              </Menu.Item>
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDeleteVariant(variant.id)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [onEditVariant, onDeleteVariant]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Product Variants</Text>
          <Button leftSection={<IconPlus size={16} />} size="sm" variant="light" onClick={onAddVariant}>
            Add Variant
          </Button>
        </Group>
        <DataTable
          columns={variantsColumns}
          data={variants}
          loading={loading}
          keyField="id"
          emptyMessage="No variants found"
          minWidth={600}
          stickyActionsColumn
        />
      </Stack>
    </Paper>
  );
}
