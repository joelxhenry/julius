import { Title, Group, Button, Modal, Stack, TextInput, Text, Pagination } from '@mantine/core';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconSearch, IconUsers } from '@tabler/icons-react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { ClientForm } from '../../components/forms/ClientForm';
import { useClients, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Client } from '../../../main/database/schema';
import { ClientFormData } from '../../utils/schemas';

const PAGE_SIZE = 50;

export function ClientsListPage() {
  const { openTab } = useTabManager();
  const { fetchPaginated, loading, create } = useClients();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<Client>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Search state
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Fetch data when page or search changes
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, debouncedSearch, fetchPaginated]);

  const columns: ColumnDef<Client>[] = useMemo(
    () => [
      { key: 'id', title: 'ID', sortable: true, width: 80 },
      { key: 'name', title: 'Name', sortable: true },
      { key: 'phone', title: 'Phone' },
      { key: 'email', title: 'Email' },
      {
        key: 'creditLimit',
        title: 'Credit Limit',
        sortable: true,
        render: (value) => `$${value || 0}`,
      },
      {
        key: 'discountRate',
        title: 'Discount %',
        sortable: true,
        render: (value) => `${value || 0}%`,
      },
    ],
    []
  );

  const handleRowClick = useCallback(
    (client: Client, options?: RowClickOptions) => {
      openTab(
        {
          type: 'client-detail',
          path: `/clients/${client.id}`,
          title: client.name || `Client #${client.id}`,
          entityId: client.id.toString(),
        },
        options?.newTab
      );
    },
    [openTab]
  );

  const handleCreate = async (data: ClientFormData) => {
    setIsCreating(true);
    try {
      await create(data);
      setCreateModalOpened(false);
      // Refresh data after create
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setPaginatedData(result);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconUsers size={32} />
          <Title order={2}>Clients</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          New Client
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name, email, phone..."
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Text size="sm" c="dimmed">
          {paginatedData.total} client{paginatedData.total !== 1 ? 's' : ''}
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

      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Create New Client"
        size="lg"
      >
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setCreateModalOpened(false)}
          loading={isCreating}
        />
      </Modal>
    </Stack>
  );
}
