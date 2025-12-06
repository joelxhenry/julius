import { useState, useEffect, useMemo } from 'react';
import { Paper, Badge, Text, Group } from '@mantine/core';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';

interface Payment {
  id: number;
  paymentDate: string;
  amount: string;
  paymentDesc: string | null;
  documentType: string;
  documentNumber: string;
  invoiceId?: number;
  paymentDesc2: string | null;
  createdAt: string;
}

interface ClientPaymentsTabProps {
  clientId: number;
}

const documentTypeColors: Record<string, string> = {
  invoice: 'blue',
  credit_note: 'orange',
  bill: 'purple',
};

const documentTypeLabels: Record<string, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit Note',
  bill: 'Bill',
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

export function ClientPaymentsTab({ clientId }: ClientPaymentsTabProps) {
  const { openTab } = useTabContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    loadPayments();
  }, [clientId, page]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, {
        clientId,
        page,
        pageSize,
      });

      if (result.success && result.data) {
        setPayments(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Payment>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Date',
        width: 120,
        render: (payment) => formatDate(payment.paymentDate),
      },
      {
        key: 'documentNumber',
        header: 'Document',
        width: 180,
        render: (payment) => (
          <Group gap="xs">
            <Badge variant="light" size="sm" color={documentTypeColors[payment.documentType]}>
              {documentTypeLabels[payment.documentType] || payment.documentType}
            </Badge>
            <Text size="sm">{payment.documentNumber}</Text>
          </Group>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 120,
        render: (payment) => (
          <Text ta="right" fw={500} c="green">
            {formatCurrency(payment.amount)}
          </Text>
        ),
      },
      {
        key: 'paymentDesc',
        header: 'Method',
        width: 120,
        render: (payment) => payment.paymentDesc || '-',
      },
      {
        key: 'reference',
        header: 'Reference',
        render: (payment) => payment.paymentDesc2 || '-',
      },
    ],
    []
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        keyField="id"
        emptyMessage="No payments found for this client"
        minWidth={700}
        onRowClick={(payment) => {
          openTab(`/payments/${payment.id}`);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
