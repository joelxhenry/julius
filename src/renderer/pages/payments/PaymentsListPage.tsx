import { Title, Group, Stack, Badge } from '@mantine/core';
import { IconCash } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { usePayments } from '../../hooks';
import type { Payment } from '../../../main/database/schema';
import numeral from 'numeral';

export function PaymentsListPage() {
  const { payments, loading } = usePayments();

  const PAYMENT_METHOD_COLORS: Record<string, string> = {
    CASH: 'green',
    CHEQUE: 'blue',
    CARD: 'violet',
    BANK_TRANSFER: 'cyan',
    OTHER: 'gray',
  };

  const columns: ColumnDef<Payment>[] = [
    {
      key: 'id',
      title: 'Payment #',
      sortable: true,
      width: 100,
      render: (value) => `#${value}`
    },
    {
      key: 'invoiceId',
      title: 'Invoice #',
      sortable: true,
      width: 120,
      render: (value) => value ? `#${value}` : 'N/A',
    },
    {
      key: 'amount',
      title: 'Amount',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'method',
      title: 'Method',
      sortable: true,
      render: (value) => (
        <Badge color={PAYMENT_METHOD_COLORS[value || 'OTHER']} size="sm">
          {value?.replace('_', ' ') || 'N/A'}
        </Badge>
      ),
    },
    {
      key: 'reference',
      title: 'Reference',
      render: (value) => value || '-',
    },
    {
      key: 'createdAt',
      title: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'notes',
      title: 'Notes',
      render: (value) => value || '-',
    },
  ];

  return (
    <Stack>
      <Group>
        <IconCash size={32} />
        <Title order={2}>Payments</Title>
      </Group>

      <DataTable
        data={payments}
        columns={columns}
        loading={loading}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
