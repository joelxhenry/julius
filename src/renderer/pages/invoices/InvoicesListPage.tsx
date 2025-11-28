import { Title, Group, Button, Stack, Switch, Text, Select, TextInput, Pagination } from '@mantine/core';
import { IconPlus, IconFileInvoice, IconHistory, IconSearch } from '@tabler/icons-react';
import { useMemo, useCallback, useState, useEffect } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useInvoices, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Invoice } from '../../../main/database/schema';
import numeral from 'numeral';

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const PAGE_SIZE = 50;

export function InvoicesListPage() {
  const { openTab } = useTabManager();
  const { fetchPaginated, loading } = useInvoices();

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Invoice>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Filter state
  const [includeHistorical, setIncludeHistorical] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [includeHistorical, statusFilter, debouncedSearch]);

  // Fetch data when page or filters change
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        includeHistorical,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, includeHistorical, statusFilter, debouncedSearch, fetchPaginated]);

  // Memoize columns to prevent recreation on every render
  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        title: 'Invoice #',
        sortable: true,
        width: 120,
      },
      {
        key: 'clientName',
        title: 'Client',
        sortable: true,
        render: (value) => value || 'Walk-in',
      },
      {
        key: 'createdAt',
        title: 'Date',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : 'N/A'),
      },
      {
        key: 'total',
        title: 'Total',
        sortable: true,
        render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
      },
      {
        key: 'balance',
        title: 'Balance',
        sortable: true,
        render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
      },
      {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (value) => <StatusBadge status={value || 'DRAFT'} />,
      },
    ],
    []
  );

  // Memoize row click handler
  const handleRowClick = useCallback(
    (invoice: Invoice, options?: RowClickOptions) => {
      openTab(
        {
          type: 'invoice-editor',
          path: `/invoices/${invoice.id}`,
          title: `Invoice ${invoice.invoiceNumber}`,
          entityId: invoice.id.toString(),
        },
        options?.newTab
      );
    },
    [openTab]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconFileInvoice size={32} />
          <Title order={2}>Invoices</Title>
        </Group>
        <Group>
          <Switch
            label={<Text size="sm">Include historical</Text>}
            checked={includeHistorical}
            onChange={(e) => setIncludeHistorical(e.currentTarget.checked)}
            thumbIcon={includeHistorical ? <IconHistory size={12} /> : null}
          />
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => openTab({
              type: 'invoice-editor',
              path: '/invoices/new',
              title: 'New Invoice',
              entityId: 'new',
            })}
          >
            New Invoice
          </Button>
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Search invoice #, client, reference..."
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by status"
          data={statusOptions}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value || 'all')}
          w={160}
          clearable={false}
        />
        <Text size="sm" c="dimmed">
          {paginatedData.total} invoice{paginatedData.total !== 1 ? 's' : ''}
        </Text>
      </Group>

      <DataTable
        data={paginatedData.data}
        columns={columns}
        loading={loading}
        onRowClick={handleRowClick}
        rowKey="id"
      />

      {paginatedData.totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={paginatedData.totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}
    </Stack>
  );
}
