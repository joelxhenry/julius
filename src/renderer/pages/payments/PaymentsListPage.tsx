import { Title, Group, Stack, Badge, TextInput, Text, Pagination, Select } from '@mantine/core';
import { IconCash, IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { usePayments, PaginatedResult } from '../../hooks';
import type { Payment } from '../../../main/database/schema';
import numeral from 'numeral';

const PAGE_SIZE = 50;

const methodOptions = [
  { value: 'all', label: 'All Methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: 'green',
  CHEQUE: 'blue',
  CARD: 'violet',
  BANK_TRANSFER: 'cyan',
  OTHER: 'gray',
};

export function PaymentsListPage() {
  const { fetchPaginated, loading } = usePayments();

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Payment>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, methodFilter]);

  // Fetch data when page or filters change
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        method: methodFilter !== 'all' ? methodFilter : undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, debouncedSearch, methodFilter, fetchPaginated]);

  const columns: ColumnDef<Payment>[] = useMemo(() => [
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
  ], []);

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconCash size={32} />
          <Title order={2}>Payments</Title>
        </Group>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reference, notes..."
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="Filter by method"
          data={methodOptions}
          value={methodFilter}
          onChange={(value) => setMethodFilter(value || 'all')}
          w={160}
          clearable={false}
        />
        <Text size="sm" c="dimmed">
          {paginatedData.total} payment{paginatedData.total !== 1 ? 's' : ''}
        </Text>
      </Group>

      <DataTable
        data={paginatedData.data}
        columns={columns}
        loading={loading}
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
