import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Text, ActionIcon, Group, Button } from '@mantine/core';
import { IconEye, IconFilterOff } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';
import { IpcChannel } from '../../../shared/types/ipc';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  total: string;
  status: string;
  expiryDate: string | null;
  createdAt: string;
}

interface ClientQuotationsTabProps {
  clientId: number;
}

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function ClientQuotationsTab({ clientId }: ClientQuotationsTabProps) {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const pageSize = 30;

  const [startDate, endDate] = dateRange;
  const hasActiveFilters = startDate !== null || endDate !== null;

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  useEffect(() => {
    loadQuotations();
  }, [clientId, page, startDate, endDate]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_PAGINATED, {
        clientId,
        page,
        pageSize,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success && result.data) {
        setQuotations(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Quotation>[] = useMemo(
    () => [
      {
        key: 'quoteNum',
        header: 'Quotation #',
        width: 150,
        render: (quotation) => <Text fw={500}>{quotation.quoteNum}</Text>,
      },
      {
        key: 'quoteDate',
        header: 'Date',
        width: 120,
        render: (quotation) => formatDate(quotation.quoteDate),
      },
      {
        key: 'expiryDate',
        header: 'Expiry Date',
        width: 120,
        render: (quotation) => formatDate(quotation.expiryDate),
      },
      {
        key: 'total',
        header: 'Total',
        width: 120,
        render: (quotation) => <Text ta="right">{formatCurrency(quotation.total)}</Text>,
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (quotation) => (
          <ActionIcon variant="subtle" onClick={() => navigate(`/quotations/${quotation.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        ),
      },
    ],
    [navigate]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Group gap="md" align="flex-end" wrap="wrap" mb="md">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        {hasActiveFilters && (
          <Button
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={16} />}
            onClick={() => setDateRange([null, null])}
          >
            Clear filters
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={quotations}
        loading={loading}
        keyField="id"
        emptyMessage="No quotations found for this client"
        minWidth={700}
        onRowClick={(quotation) => navigate(`/quotations/${quotation.id}`)}
        stickyActionsColumn
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
