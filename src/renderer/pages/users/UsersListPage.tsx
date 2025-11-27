import { Title, Group, Button, Stack, Badge } from '@mantine/core';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { useUsers } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { User } from '../../../main/database/schema';

export function UsersListPage() {
  const { users, loading } = useUsers();
  const { openTab } = useTabManager();

  const columns: ColumnDef<User>[] = [
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
  ];

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

      <DataTable
        data={users}
        columns={columns}
        loading={loading}
        onRowClick={(user) => openTab({
          type: 'user-detail',
          path: `/users/${user.id}`,
          title: `${user.firstName} ${user.lastName}`,
          entityId: user.id.toString(),
        })}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
