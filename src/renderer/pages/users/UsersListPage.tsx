import { Title, Group, Button, Stack, Badge, TextInput, Text, Pagination, Switch } from '@mantine/core';
import { IconPlus, IconUsers, IconSearch } from '@tabler/icons-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { useUsers, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { User } from '../../../main/database/schema';

const PAGE_SIZE = 50;

export function UsersListPage() {
  const { fetchPaginated, loading } = useUsers();
  const { openTab } = useTabManager();

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [paginatedData, setPaginatedData] = useState<PaginatedResult<User>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  });

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeOnly]);

  // Fetch data when page or filters change
  useEffect(() => {
    const loadData = async () => {
      const result = await fetchPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        activeOnly: activeOnly || undefined,
      });
      setPaginatedData(result);
    };
    loadData();
  }, [page, debouncedSearch, activeOnly, fetchPaginated]);

  const columns: ColumnDef<User>[] = useMemo(() => [
    {
      key: 'id',
      title: 'ID',
      sortable: true,
      width: 80,
    },
    {
      key: 'username',
      title: 'Username',
      sortable: true,
    },
    {
      key: 'firstName',
      title: 'First Name',
      sortable: true,
    },
    {
      key: 'lastName',
      title: 'Last Name',
      sortable: true,
    },
    {
      key: 'title',
      title: 'Job Title',
      render: (value) => value || '-',
    },
    {
      key: 'roleId',
      title: 'Role',
      render: (value) => {
        const roleNames: Record<number, string> = {
          1: 'Admin',
          2: 'Manager',
          3: 'Cashier',
        };
        return roleNames[value as number] || 'User';
      },
    },
    {
      key: 'active',
      title: 'Status',
      render: (value) => (
        <Badge color={value ? 'green' : 'gray'} size="sm">
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ], []);

  const handleRowClick = useCallback(
    (user: User, options?: RowClickOptions) => {
      openTab(
        {
          type: 'user-detail',
          path: `/users/${user.id}`,
          title: `${user.firstName} ${user.lastName}`,
          entityId: user.id.toString(),
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
          <IconUsers size={32} />
          <Title order={2}>Users</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => openTab({
            type: 'user-detail',
            path: '/users/new',
            title: 'New User',
            entityId: 'new',
          })}
        >
          New User
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search by name, username..."
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Switch
          label={<Text size="sm">Active only</Text>}
          checked={activeOnly}
          onChange={(e) => setActiveOnly(e.currentTarget.checked)}
        />
        <Text size="sm" c="dimmed">
          {paginatedData.total} user{paginatedData.total !== 1 ? 's' : ''}
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
