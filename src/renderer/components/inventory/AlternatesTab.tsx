import { useEffect, useMemo, useState } from 'react';
import { Paper, Stack, Group, Text, Button, ActionIcon, Box } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { CopyButton, ProductDisplay } from '../common';
import { MarkButton } from '../tray/MarkButton';
import { IpcChannel } from '../../../shared/types/ipc';

interface InventoryAlternate {
  id: number;
  partNo: string;
  alternateNo: string;
  supplier: string | null;
}

/** Resolved inventory detail for an alternate part number, when it is stocked. */
interface AlternateDetail {
  description1: string | null;
  category: string | null;
  model: string | null;
  price: string | null;
  quantity: number;
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
  // Resolved full details for each alternate part number that exists in inventory.
  const [details, setDetails] = useState<Record<string, AlternateDetail | null>>({});

  const altSku = useMemo(
    () => (alt: InventoryAlternate) => (alt.partNo === currentSku ? alt.alternateNo : alt.partNo),
    [currentSku]
  );

  // Fetch inventory details for the alternate SKUs so we can show full part info
  // (category, model, price, on-hand) rather than just the number.
  useEffect(() => {
    let cancelled = false;
    const skus = Array.from(new Set(alternates.map(altSku).filter(Boolean)));
    (async () => {
      const entries = await Promise.all(
        skus.map(async (sku) => {
          try {
            const res = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku });
            if (res.success && res.data) {
              const d = res.data;
              return [
                sku,
                {
                  description1: d.description1 ?? null,
                  category: d.category ?? null,
                  model: d.model ?? null,
                  price: d.price ?? null,
                  quantity: d.quantity ?? 0,
                } as AlternateDetail,
              ] as const;
            }
          } catch {
            /* fall through to null */
          }
          return [sku, null] as const;
        })
      );
      if (!cancelled) setDetails(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [alternates, altSku]);

  const alternatesColumns: Column<InventoryAlternate>[] = useMemo(
    () => [
      {
        key: 'alternateNo',
        header: 'Alternate Part',
        render: (alt) => {
          const alternateSku = altSku(alt);
          const detail = details[alternateSku];
          return (
            <Box
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigateToAlternate(alternateSku)}
            >
              {detail ? (
                <Stack gap={2}>
                  <ProductDisplay
                    product={{
                      sku: alternateSku,
                      category: detail.category,
                      model: detail.model,
                      price: detail.price,
                    }}
                    size="xs"
                    showCopyButton
                  />
                  {detail.description1 && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {detail.description1}
                    </Text>
                  )}
                </Stack>
              ) : (
                <Stack gap={0}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="md" fw={600} c="blue">
                      {alternateSku}
                    </Text>
                    <CopyButton value={alternateSku} />
                  </Group>
                  <Text size="sm" c="dimmed">
                    not in inventory
                  </Text>
                </Stack>
              )}
            </Box>
          );
        },
      },
      {
        key: 'quantity',
        header: 'On Hand',
        width: 90,
        render: (alt) => {
          const detail = details[altSku(alt)];
          return <Text size="sm">{detail ? detail.quantity : '-'}</Text>;
        },
      },
      {
        key: 'supplier',
        header: 'Supplier',
        render: (alt) => alt.supplier || '-',
      },
      {
        key: 'mark',
        header: '',
        width: 48,
        render: (alt) => <MarkButton mode="item" parentSku={altSku(alt)} />,
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (alt) => (
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => onDeleteAlternate(altSku(alt))}
            title="Remove alternate"
          >
            <IconTrash size={16} />
          </ActionIcon>
        ),
      },
    ],
    [altSku, details, onNavigateToAlternate, onDeleteAlternate]
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
          minWidth={480}
          stickyActionsColumn
        />
      </Stack>
    </Paper>
  );
}
