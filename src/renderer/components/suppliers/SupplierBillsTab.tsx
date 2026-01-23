import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Badge, Text, ActionIcon } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';

interface Bill {
  id: number;
  billNo: string;
  billDate: string;
  total: string;
  totalPaid: string;
  status: string;
  createdAt: string;
}

interface SupplierBillsTabProps {
  supplierId: number;
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  partially_paid: 'orange',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
};

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function SupplierBillsTab({ supplierId }: SupplierBillsTabProps) {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBills();
  }, [supplierId]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_BILLS_BY_SUPPLIER, {
        supplierId,
      });
      if (result.success && result.data) {
        setBills(result.data);
      }
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Bill>[] = useMemo(
    () => [
      {
        key: 'billNo',
        header: 'Bill #',
        width: 150,
        render: (bill) => <Text fw={500}>{bill.billNo}</Text>,
      },
      {
        key: 'billDate',
        header: 'Date',
        width: 120,
        render: (bill) => formatDate(bill.billDate),
      },
      {
        key: 'total',
        header: 'Total',
        width: 120,
        render: (bill) => <Text ta="right">{formatCurrency(bill.total)}</Text>,
      },
      {
        key: 'totalPaid',
        header: 'Paid',
        width: 120,
        render: (bill) => (
          <Text ta="right" c="green">
            {formatCurrency(bill.totalPaid)}
          </Text>
        ),
      },
      {
        key: 'balance',
        header: 'Balance',
        width: 120,
        render: (bill) => {
          const balance = parseFloat(bill.total) - parseFloat(bill.totalPaid);
          return (
            <Text ta="right" c={balance > 0 ? 'red' : 'green'}>
              {formatCurrency(balance.toFixed(2))}
            </Text>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (bill) => (
          <Badge color={statusColors[bill.status] || 'gray'} variant="light">
            {statusLabels[bill.status] || bill.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (bill) => (
          <ActionIcon variant="subtle" onClick={() => navigate(`/bills/${bill.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        ),
      },
    ],
    [navigate]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={bills}
        loading={loading}
        keyField="id"
        emptyMessage="No bills found for this supplier"
        minWidth={700}
        onRowClick={(bill) => navigate(`/bills/${bill.id}`)}
        stickyActionsColumn
      />
    </Paper>
  );
}
