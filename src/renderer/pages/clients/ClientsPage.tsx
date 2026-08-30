import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Badge,
  ActionIcon,
  Text,
  Menu,
  Checkbox,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconEye,
  IconEdit,
  IconDotsVertical,
  IconTrash,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column } from '../../components/common/DataTable';
import { PermissionButton, usePermissions } from '../../permissions';

interface Client {
  id: number;
  clNumber: string | null;
  clientName: string;
  contact: string | null;
  phone: string | null;
  creditLimit: string;
  isBadCredit: boolean;
  isTaxable: boolean;
}

interface PaginatedResult {
  data: Client[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function ClientsPage() {
  const navigate = useNavigate();
  const { replaceCurrentTab } = useTabContext();
  const { runWithPermission } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [badCreditOnly, setBadCreditOnly] = useState(false);
  const [taxableOnly, setTaxableOnly] = useState(false);

  const pageSize = 20;

  const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENTS_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
        badCreditOnly,
        taxableOnly,
      });

      if (result.success && result.data) {
        const paginatedResult = result.data as PaginatedResult;
        setClients(paginatedResult.data);
        setTotal(paginatedResult.total);
        setTotalPages(paginatedResult.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, badCreditOnly, taxableOnly]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, badCreditOnly, taxableOnly]);

  // Sensitive action: if the user lacks DELETE_CLIENT, another authorised user
  // can approve it once (recorded), then the identity reverts to the current user.
  const requestDeleteClient = (client: Client) => {
    runWithPermission(
      { permissionCode: 'DELETE_CLIENT', actionLabel: `Delete client ${client.clientName}`, context: { entity: 'client', id: client.id } },
      () => handleDeleteClient(client)
    );
  };

  const handleDeleteClient = (client: Client) => {
    modals.openConfirmModal({
      title: 'Delete Client',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{client.clientName}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.DELETE_CLIENT, { id: client.id });
          if (result.success) {
            notifications.show({
              title: 'Client Deleted',
              message: `${client.clientName} has been deleted successfully`,
              color: 'green',
            });
            fetchClients();
          } else {
            notifications.show({
              title: 'Error',
              message: result.error || 'Failed to delete client',
              color: 'red',
            });
          }
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'An unexpected error occurred',
            color: 'red',
          });
        }
      },
    });
  };

  const columns: Column<Client>[] = useMemo(
    () => [
      {
        key: 'clientName',
        header: 'Client Name',
        render: (client) => (
          <Text fw={500}>
            {client.clientName}
          </Text>
        ),
      },
      {
        key: 'clNumber',
        header: 'CL Number',
        render: (client) =>
          client.clNumber ? (
            <Badge variant="light" size="sm">
              {client.clNumber}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          ),
      },
      {
        key: 'phone',
        header: 'Phone',
        accessor: 'phone',
        render: (client) => (
          <Text size="sm">{client.phone || '-'}</Text>
        ),
      },
      {
        key: 'creditLimit',
        header: 'Credit Limit',
        render: (client) => (
          <Text size="sm">{formatCurrency(client.creditLimit)}</Text>
        ),
      },
      {
        key: 'badCredit',
        header: 'Credit Status',
        render: (client) => (
          <Badge color={client.isBadCredit ? 'red' : 'gray'} variant="light" size="sm">
            {client.isBadCredit ? 'Bad Credit' : 'Good'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 100,
        render: (client) => (
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={(e) => {
                e.stopPropagation();
                replaceCurrentTab(`/clients/${client.id}`);
              }}
              title="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => navigate(`/clients/${client.id}/edit`)}
                >
                  Edit
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={() => requestDeleteClient(client)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ),
      },
    ],
    [navigate, replaceCurrentTab]
  );

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Clients</Title>
        <PermissionButton
          permission="CREATE_CLIENT"
          whenDenied="disable"
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/clients/new')}
        >
          Add Client
        </PermissionButton>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          {/* Filters */}
          <Group gap="md">
            <TextInput
              placeholder="Search clients..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Checkbox
              label="Bad Credit Only"
              checked={badCreditOnly}
              onChange={(e) => setBadCreditOnly(e.target.checked)}
            />
            <Checkbox
              label="Taxable Only"
              checked={taxableOnly}
              onChange={(e) => setTaxableOnly(e.target.checked)}
            />
            <ActionIcon variant="subtle" onClick={fetchClients} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Results count */}
          <Text size="sm" c="dimmed">
            {total} client{total !== 1 ? 's' : ''} found
          </Text>

          {/* Table */}
          <DataTable
            columns={columns}
            data={clients}
            loading={loading}
            keyField="id"
            onRowClick={(client) => replaceCurrentTab(`/clients/${client.id}`)}
            emptyMessage="No clients found"
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            skeletonRows={5}
            stickyActionsColumn
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
