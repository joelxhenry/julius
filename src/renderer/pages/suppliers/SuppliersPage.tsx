import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Button,
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
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column } from '../../components/common/DataTable';

interface Supplier {
  id: number;
  company: string;
  contact1: string | null;
  phone1: string | null;
  email1: string | null;
  credit: string | null;
  isActive: boolean;
  isTaxable: boolean | null;
}

interface PaginatedResult {
  data: Supplier[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function SuppliersPage() {
  const navigate = useNavigate();
  const { replaceCurrentTab } = useTabContext();
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);

  const pageSize = 20;

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_SUPPLIERS_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
        activeOnly,
      });

      if (result.success && result.data) {
        const paginatedResult = result.data as PaginatedResult;
        setSuppliers(paginatedResult.data);
        setTotal(paginatedResult.total);
        setTotalPages(paginatedResult.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch suppliers:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, activeOnly]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeOnly]);

  const handleDeleteSupplier = (supplier: Supplier) => {
    modals.openConfirmModal({
      title: 'Delete Supplier',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{supplier.company}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.DELETE_SUPPLIER, { id: supplier.id });
          if (result.success) {
            notifications.show({
              title: 'Supplier Deleted',
              message: `${supplier.company} has been deleted successfully`,
              color: 'green',
            });
            fetchSuppliers();
          } else {
            notifications.show({
              title: 'Error',
              message: result.error || 'Failed to delete supplier',
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

  const handleToggleActive = async (supplier: Supplier) => {
    try {
      const channel = supplier.isActive ? IpcChannel.DEACTIVATE_SUPPLIER : IpcChannel.ACTIVATE_SUPPLIER;
      const result = await window.electron.invoke(channel, { id: supplier.id });
      if (result.success) {
        notifications.show({
          title: supplier.isActive ? 'Supplier Deactivated' : 'Supplier Activated',
          message: `${supplier.company} has been ${supplier.isActive ? 'deactivated' : 'activated'}`,
          color: 'green',
        });
        fetchSuppliers();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to update supplier status',
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
  };

  const columns: Column<Supplier>[] = useMemo(
    () => [
      {
        key: 'company',
        header: 'Company',
        render: (supplier) => <Text fw={500}>{supplier.company}</Text>,
      },
      {
        key: 'contact1',
        header: 'Contact',
        render: (supplier) => <Text size="sm">{supplier.contact1 || '—'}</Text>,
      },
      {
        key: 'phone1',
        header: 'Phone',
        render: (supplier) => <Text size="sm">{supplier.phone1 || '—'}</Text>,
      },
      {
        key: 'email1',
        header: 'Email',
        render: (supplier) => <Text size="sm">{supplier.email1 || '—'}</Text>,
      },
      {
        key: 'isActive',
        header: 'Status',
        width: 100,
        render: (supplier) => (
          <Badge color={supplier.isActive ? 'green' : 'gray'} variant="light" size="sm">
            {supplier.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 100,
        render: (supplier) => (
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={(e) => {
                e.stopPropagation();
                replaceCurrentTab(`/suppliers/${supplier.id}`);
              }}
              title="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" onClick={(e) => e.stopPropagation()}>
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={supplier.isActive ? <IconX size={14} /> : <IconCheck size={14} />}
                  onClick={() => handleToggleActive(supplier)}
                >
                  {supplier.isActive ? 'Deactivate' : 'Activate'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={() => handleDeleteSupplier(supplier)}
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
        <Title order={2}>Suppliers</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/suppliers/new')}>
          Add Supplier
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          {/* Filters */}
          <Group gap="md">
            <TextInput
              placeholder="Search suppliers..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Checkbox
              label="Active Only"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            <ActionIcon variant="subtle" onClick={fetchSuppliers} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Results count */}
          <Text size="sm" c="dimmed">
            {total} supplier{total !== 1 ? 's' : ''} found
          </Text>

          {/* Table */}
          <DataTable
            columns={columns}
            data={suppliers}
            loading={loading}
            keyField="id"
            onRowClick={(supplier) => replaceCurrentTab(`/suppliers/${supplier.id}`)}
            emptyMessage="No suppliers found"
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
