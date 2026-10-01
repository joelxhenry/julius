import { useMemo } from 'react';
import { Paper, Stack, Group, Text, Button, Badge, ActionIcon, Menu, NumberFormatter } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconDotsVertical } from '@tabler/icons-react';
import { DataTable, Column, CopyButton } from '../common';
import { MarkButton } from '../tray/MarkButton';
import { AddToListButton } from '../lists';
import { formatVariantName } from '../../../shared/utils/variantName';

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  location: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
  isBase: boolean;
}

interface VariantsTabProps {
  variants: Variant[];
  loading: boolean;
  parentIsTaxable: boolean;
  /** Base product's name - always prepended to each variant's name. */
  parentName: string | null;
  onAddVariant: () => void;
  onEditVariant: (variant: Variant) => void;
  onDeleteVariant: (variantId: number) => void;
}

export function VariantsTab({ variants, loading, parentIsTaxable, parentName, onAddVariant, onEditVariant, onDeleteVariant }: VariantsTabProps) {
  const variantsColumns: Column<Variant>[] = useMemo(
    () => [
      {
        key: 'variantSku',
        header: 'Part',
        width: 180,
        render: (variant) => (
          <Group gap="xs">
            <Text fw={500}>{variant.variantSku}</Text>
            <CopyButton value={variant.variantSku} />
          </Group>
        ),
      },
      {
        key: 'location',
        header: 'Location',
        width: 120,
        render: (variant) => variant.location || '-',
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
        key: 'mark',
        header: '',
        width: 84,
        render: (variant) => (
          <Group gap={4} wrap="nowrap">
            <MarkButton
              mode="variant"
              item={{
                partNumber: variant.variantSku,
                description: variant.description ?? formatVariantName(parentName, variant.variantName, variant.isBase),
                unitPrice: Number(variant.price ?? 0) || 0,
                isTaxable: parentIsTaxable,
                isVariant: true,
                parentPartNumber: variant.parentSku,
              }}
            />
            <AddToListButton
              mode="variant"
              item={{
                sku: variant.variantSku,
                isVariant: true,
                description: variant.description ?? formatVariantName(parentName, variant.variantName, variant.isBase),
              }}
            />
          </Group>
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
    [onEditVariant, onDeleteVariant, parentIsTaxable, parentName]
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
