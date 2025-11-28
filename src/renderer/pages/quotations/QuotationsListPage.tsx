import { Title, Group, Button, Stack, TextInput, Text, Pagination, Select } from '@mantine/core';
import { IconPlus, IconFileDescription, IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useQuotations, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Quotation } from '../../../main/database/schema';
import numeral from 'numeral';

const PAGE_SIZE = 50;

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'expired', label: 'Expired' },
];

export function QuotationsListPage() {
  const { openTab } = useTabManager();
  const { fetchPaginated, loading } = useQuotations();

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Quotation>>({
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

  const columns: ColumnDef<Quotation>[] = useMemo(() => [
    {
      key: 'id',
      title: 'Quotation #',
      sortable: true,
      width: 120,
      render: (value) => `#${value}`
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
      key: 'total',
      title: 'Total',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value || 'DRAFT'} />,
    },
  ], []);

  const handleRowClick = useCallback(
    (quotation: Quotation, options?: RowClickOptions) => {
      openTab(
        {
          type: 'quotation-editor',
          path: `/quotations/${quotation.id}`,
          title: `Quotation #${quotation.id}`,
          entityId: quotation.id.toString(),
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
          <IconFileDescription size={32} />
          <Title order={2}>Quotations</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => openTab({
            type: 'quotation-editor',
            path: '/quotations/new',
            title: 'New Quotation',
            entityId: 'new',
          })}
        >
          New Quotation
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by reference, client..."
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
          {paginatedData.total} quotation{paginatedData.total !== 1 ? 's' : ''}
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
