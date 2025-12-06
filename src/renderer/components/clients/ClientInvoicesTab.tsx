import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Badge, Text, ActionIcon } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  total: string;
  totalPaid: string;
  status: string;
  createdAt: string;
}

interface ClientInvoicesTabProps {
  clientId: number;
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
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

export function ClientInvoicesTab({ clientId }: ClientInvoicesTabProps) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadInvoices();
  }, [clientId]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES_BY_CLIENT, { clientId });
      if (result.success && result.data) {
        setInvoices(result.data);
      }
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Invoice>[] = useMemo(
    () => [
      {
        key: 'invNumber',
        header: 'Invoice #',
        width: 150,
        render: (invoice) => <Text fw={500}>{invoice.invNumber}</Text>,
      },
      {
        key: 'invDate',
        header: 'Date',
        width: 120,
        render: (invoice) => formatDate(invoice.invDate),
      },
      {
        key: 'total',
        header: 'Total',
        width: 120,
        render: (invoice) => <Text ta="right">{formatCurrency(invoice.total)}</Text>,
      },
      {
        key: 'totalPaid',
        header: 'Paid',
        width: 120,
        render: (invoice) => <Text ta="right" c="green">{formatCurrency(invoice.totalPaid)}</Text>,
      },
      {
        key: 'balance',
        header: 'Balance',
        width: 120,
        render: (invoice) => {
          const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
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
        render: (invoice) => (
          <Badge color={statusColors[invoice.status] || 'gray'} variant="light">
            {statusLabels[invoice.status] || invoice.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (invoice) => (
          <ActionIcon variant="subtle" onClick={() => navigate(`/invoices/${invoice.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        ),
      },
    ],
    [navigate]
  );

  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return invoices.slice(start, end);
  }, [invoices, page, pageSize]);

  const totalPages = Math.ceil(invoices.length / pageSize);

  return (
    <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={paginatedInvoices}
        loading={loading}
        keyField="id"
        emptyMessage="No invoices found for this client"
        minWidth={700}
        onRowClick={(invoice) => navigate(`/invoices/${invoice.id}`)}
        stickyActionsColumn
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
