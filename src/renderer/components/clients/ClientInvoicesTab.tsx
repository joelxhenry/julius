import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Badge, Text, Group, Select, Button } from '@mantine/core';
import { IconEye, IconCash, IconFilterOff } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue, getLastNDaysRange } from '../common/DateRangeFilter';
import { RecordPaymentModal } from '../invoices';
import { IpcChannel } from '../../../shared/types/ipc';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  clientId: number | null;
  clientName: string | null;
  total: string;
  totalPaid: string;
  status: string;
  createdAt: string;
}

interface ClientInvoicesTabProps {
  clientId: number;
  clientName?: string;
}

const statusColors: Record<string, string> = {
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
};

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'partially_paid', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

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

export function ClientInvoicesTab({ clientId, clientName }: ClientInvoicesTabProps) {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getLastNDaysRange(30));
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const pageSize = 30;

  const [startDate, endDate] = dateRange;
  const hasActiveFilters = status !== 'all' || startDate !== null || endDate !== null;

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [status, startDate, endDate]);

  useEffect(() => {
    loadInvoices();
  }, [clientId, page, status, startDate, endDate]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICES_PAGINATED, {
        clientId,
        page,
        pageSize,
        status,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success && result.data) {
        setInvoices(result.data.data);
        setTotalPages(result.data.totalPages);
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
        width: 200,
        render: (invoice) => {
          const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
          const canPay = balance > 0.001 && invoice.status !== 'archived';
          return (
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="light"
                size="xs"
                leftSection={<IconEye size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/invoices/${invoice.id}`);
                }}
              >
                View
              </Button>
              {canPay && (
                <Button
                  variant="light"
                  color="green"
                  size="xs"
                  leftSection={<IconCash size={14} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPayInvoice(invoice);
                  }}
                >
                  Pay
                </Button>
              )}
            </Group>
          );
        },
      },
    ],
    [navigate]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Group gap="md" align="flex-end" wrap="wrap" mb="md">
        <Select
          label="Status"
          data={statusOptions}
          value={status}
          onChange={(value) => setStatus(value || 'all')}
          allowDeselect={false}
          w={180}
        />
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {hasActiveFilters && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} />}
            onClick={() => {
              setStatus('all');
              setDateRange([null, null]);
            }}
          >
            Clear filters
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={invoices}
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

      <RecordPaymentModal
        opened={payInvoice !== null}
        onClose={() => setPayInvoice(null)}
        onPaymentRecorded={() => {
          setPayInvoice(null);
          loadInvoices();
        }}
        onCreditApplied={loadInvoices}
        invoice={
          payInvoice
            ? {
                id: payInvoice.id,
                invNumber: payInvoice.invNumber,
                clientId: payInvoice.clientId ?? clientId,
                clientName: payInvoice.clientName ?? clientName ?? null,
                total: payInvoice.total,
                totalPaid: payInvoice.totalPaid,
              }
            : null
        }
      />
    </Paper>
  );
}
