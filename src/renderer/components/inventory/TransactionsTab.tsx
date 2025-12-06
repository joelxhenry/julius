import { useMemo } from 'react';
import { Paper, Badge, Text } from '@mantine/core';
import { DataTable, Column } from '../common/DataTable';

interface InventoryTransaction {
  id: number;
  sku: string;
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

interface TransactionsTabProps {
  transactions: InventoryTransaction[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TransactionsTab({ transactions, loading, page, totalPages, onPageChange }: TransactionsTabProps) {
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
      <DataTable
        columns={transactionsColumns}
        data={transactions}
        loading={loading}
        keyField="id"
        emptyMessage="No transactions found"
        minWidth={600}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </Paper>
  );
}
