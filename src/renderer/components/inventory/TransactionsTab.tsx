import { useMemo } from 'react';
import { Paper, Badge, Text, Group, Select, Button, Stack, Anchor, Tooltip } from '@mantine/core';
import { IconFilterOff, IconExternalLink } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';
import { CopyButton } from '../common/CopyButton';

interface InventoryTransaction {
  id: number;
  sku: string;
  variantSku: string | null;
  activity: string;
  reference: string | null;
  quantity: number;
  activityDate: string;
  createdAt: Date;
}

const ACTIVITY_LABELS: Record<string, string> = {
  IN: 'Received',
  OUT: 'Sold',
  ADJ: 'Adjustment',
  RET: 'Return',
  TRF: 'Transfer',
};

const ACTIVITY_COLORS: Record<string, string> = {
  IN: 'green',
  OUT: 'red',
  ADJ: 'blue',
  RET: 'orange',
  TRF: 'violet',
};

const ACTIVITY_OPTIONS = [
  { value: 'all', label: 'All Activities' },
  ...Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label })),
];

interface VariantFilterOption {
  value: string;
  label: string;
}

interface TransactionsTabProps {
  transactions: InventoryTransaction[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activity: string | null;
  onActivityChange: (activity: string | null) => void;
  variant: string | null;
  onVariantChange: (variant: string | null) => void;
  variantOptions: VariantFilterOption[];
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  onOpenReference: (reference: string) => void;
}

export function TransactionsTab({
  transactions,
  loading,
  page,
  totalPages,
  onPageChange,
  activity,
  onActivityChange,
  variant,
  onVariantChange,
  variantOptions,
  dateRange,
  onDateRangeChange,
  onOpenReference,
}: TransactionsTabProps) {
  // Only the base item + variants entries means there are no real variants to filter by.
  const hasVariants = variantOptions.length > 2;

  const hasActiveFilters =
    (activity !== null && activity !== 'all') ||
    (variant !== null && variant !== 'all') ||
    dateRange[0] !== null ||
    dateRange[1] !== null;

  const transactionsColumns: Column<InventoryTransaction>[] = useMemo(
    () => [
      {
        key: 'activityDate',
        header: 'Date',
        width: 120,
        accessor: 'activityDate',
      },
      {
        key: 'activity',
        header: 'Activity',
        width: 120,
        render: (trans) => (
          <Badge color={ACTIVITY_COLORS[trans.activity] || 'gray'} variant="light" size="sm">
            {ACTIVITY_LABELS[trans.activity] || trans.activity}
          </Badge>
        ),
      },
      {
        key: 'variantSku',
        header: 'Variant',
        width: 180,
        render: (trans) =>
          trans.variantSku ? (
            <Group gap={4} wrap="nowrap">
              <Text size="sm" fw={500}>{trans.variantSku}</Text>
              <CopyButton value={trans.variantSku} tooltip="Copy variant" />
            </Group>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          ),
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: 100,
        render: (trans) => (
          <Text c={trans.quantity > 0 ? 'green' : trans.quantity < 0 ? 'red' : undefined}>
            {trans.quantity > 0 ? '+' : ''}
            {trans.quantity}
          </Text>
        ),
      },
      {
        key: 'reference',
        header: 'Reference',
        render: (trans) =>
          trans.reference ? (
            <Tooltip label="Open in new tab" withArrow position="top">
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => onOpenReference(trans.reference!)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {trans.reference}
                <IconExternalLink size={14} />
              </Anchor>
            </Tooltip>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          ),
      },
    ],
    []
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <Select
            label="Activity Type"
            data={ACTIVITY_OPTIONS}
            value={activity ?? 'all'}
            onChange={onActivityChange}
            allowDeselect={false}
            w={200}
          />
          {hasVariants && (
            <Select
              label="Variant"
              data={variantOptions}
              value={variant ?? 'all'}
              onChange={onVariantChange}
              allowDeselect={false}
              w={220}
            />
          )}
          <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => {
                onActivityChange('all');
                onVariantChange('all');
                onDateRangeChange([null, null]);
              }}
            >
              Clear filters
            </Button>
          )}
        </Group>

        <DataTable
          columns={transactionsColumns}
          data={transactions}
          loading={loading}
          keyField="id"
          emptyMessage="No activity found"
          minWidth={750}
          verticalSpacing="md"
          horizontalSpacing="lg"
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </Stack>
    </Paper>
  );
}
