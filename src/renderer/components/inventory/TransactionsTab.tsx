import { useMemo } from 'react';
import { Paper, Badge, Text, Group, Select, Button, Stack } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';

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

interface TransactionsTabProps {
  transactions: InventoryTransaction[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activity: string | null;
  onActivityChange: (activity: string | null) => void;
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
}

export function TransactionsTab({
  transactions,
  loading,
  page,
  totalPages,
  onPageChange,
  activity,
  onActivityChange,
  dateRange,
  onDateRangeChange,
}: TransactionsTabProps) {
  const hasActiveFilters =
    (activity !== null && activity !== 'all') || dateRange[0] !== null || dateRange[1] !== null;

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
        width: 150,
        render: (trans) =>
          trans.variantSku ? (
            <Badge color="grape" variant="light" size="sm">
              {trans.variantSku}
            </Badge>
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
        render: (trans) => trans.reference || '-',
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
          <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => {
                onActivityChange('all');
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
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </Stack>
    </Paper>
  );
}
