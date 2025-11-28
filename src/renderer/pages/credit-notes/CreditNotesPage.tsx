import { Title, Group, Button, Stack, TextInput, Text, Pagination, Select } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconReceipt, IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useCreditNotes, PaginatedResult } from '../../hooks';
import type { CreditNote } from '../../../main/database/schema';
import numeral from 'numeral';

const PAGE_SIZE = 50;

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'partial', label: 'Partial' },
];

export function CreditNotesPage() {
  const navigate = useNavigate();
  const { fetchPaginated, loading } = useCreditNotes();

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<CreditNote>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  // Fetch data when page or filters change
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, debouncedSearch, statusFilter, fetchPaginated]);

  const columns: ColumnDef<CreditNote>[] = useMemo(() => [
    {
      key: 'legacyId',
      title: 'Credit Note #',
      sortable: true,
      width: 140,
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
      key: 'clientId',
      title: 'Client',
      sortable: true,
      render: (value) => value || 'Walk-in'
    },
    {
      key: 'createdAt',
      title: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'amount',
      title: 'Amount',
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
    {
      key: 'reason',
      title: 'Reason',
      render: (value) => value || '-',
    },
  ], []);

  const handleRowClick = useCallback(
    (creditNote: CreditNote) => {
      navigate(`/credit-notes/${creditNote.id}`);
    },
    [navigate]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconReceipt size={32} />
          <Title order={2}>Credit Notes</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/credit-notes/new')}
        >
          New Credit Note
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reason..."
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
          {paginatedData.total} credit note{paginatedData.total !== 1 ? 's' : ''}
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
