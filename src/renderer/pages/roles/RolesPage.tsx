import { useState, useEffect, useCallback, useMemo } from 'react';
import { Stack, Title, Paper, Group, Text, Badge, ActionIcon, Menu, Button } from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconDotsVertical,
  IconTrash,
  IconRefresh,
  IconShieldCheck,
  IconShield,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { DataTable, Column } from '../../components/common/DataTable';
import { PermissionButton, usePermissions } from '../../permissions';

interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  isSuperAdmin: boolean;
  isSystem: boolean;
}

export function RolesPage() {
  const navigate = useNavigate();
  const { runWithPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_ROLES);
      if (result.success && result.data) {
        setRoles(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const doDelete = useCallback(
    async (role: Role) => {
      const result = await window.electron.invoke(IpcChannel.DELETE_ROLE, { id: role.id });
      if (result.success) {
        notifications.show({ title: 'Role Deleted', message: `${role.name} has been deleted`, color: 'green' });
        fetchRoles();
      } else {
        notifications.show({ title: 'Cannot Delete', message: result.error || 'Failed to delete role', color: 'red' });
      }
    },
    [fetchRoles]
  );

  const confirmDelete = useCallback(
    (role: Role) => {
      modals.openConfirmModal({
        title: 'Delete Role',
        children: (
          <Text size="sm">
            Delete the role <strong>{role.name}</strong>? Employees will need to be reassigned.
          </Text>
        ),
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => doDelete(role),
      });
    },
    [doDelete]
  );

  const requestDelete = useCallback(
    (role: Role) => {
      runWithPermission(
        { permissionCode: 'MANAGE_ROLES', actionLabel: `Delete role ${role.name}`, context: { entity: 'role', id: role.id } },
        () => confirmDelete(role)
      );
    },
    [runWithPermission, confirmDelete]
  );

  const columns: Column<Role>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Role',
        render: (role) => (
          <Group gap="xs" wrap="nowrap">
            {role.isSuperAdmin ? (
              <IconShieldCheck size={16} color="var(--mantine-color-orange-6)" />
            ) : (
              <IconShield size={16} color="var(--mantine-color-gray-5)" />
            )}
            <Text fw={500}>{role.name}</Text>
            {role.isSystem && (
              <Badge size="xs" variant="light" color="gray">
                System
              </Badge>
            )}
          </Group>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (role) => (
          <Text size="sm" c="dimmed">
            {role.description || '-'}
          </Text>
        ),
      },
      {
        key: 'access',
        header: 'Access',
        render: (role) =>
          role.isSuperAdmin ? (
            <Badge color="orange" variant="light" size="sm">
              Full access
            </Badge>
          ) : (
            <Badge color="blue" variant="light" size="sm">
              {Object.values(role.permissions || {}).filter(Boolean).length} permission(s)
            </Badge>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (role) => (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" onClick={(e) => e.stopPropagation()}>
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => navigate(`/roles/${role.id}`)}>
                Edit
              </Menu.Item>
              {!role.isSystem && (
                <>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => requestDelete(role)}>
                    Delete
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [navigate, requestDelete]
  );

  return (
    <Stack p="xl" gap="lg">
      <Group>
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Group>
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Title order={2}>Roles</Title>
          <Text c="dimmed" size="sm">
            Define roles and the permissions they grant, then assign them to employees.
          </Text>
        </Stack>
        <Group>
          <ActionIcon variant="subtle" onClick={fetchRoles} title="Refresh">
            <IconRefresh size={18} />
          </ActionIcon>
          <PermissionButton
            permission="MANAGE_ROLES"
            whenDenied="disable"
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/roles/new')}
          >
            Add Role
          </PermissionButton>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <DataTable
          columns={columns}
          data={roles}
          loading={loading}
          keyField="id"
          onRowClick={(role) => navigate(`/roles/${role.id}`)}
          emptyMessage="No roles yet"
          skeletonRows={4}
          stickyActionsColumn
        />
      </Paper>
    </Stack>
  );
}
