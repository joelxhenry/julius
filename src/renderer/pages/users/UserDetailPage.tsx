import { useParams } from 'react-router-dom';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Text,
  LoadingOverlay,
  Badge,
  SimpleGrid,
  Modal,
  Tabs,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconKey,
  IconFileInvoice,
  IconCash,
  IconHistory,
} from '@tabler/icons-react';
import { useEffect, useState, useMemo } from 'react';
import { useUsers, useInvoices, usePayments } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import { UserForm } from '../../components/forms/UserForm';
import { ResetPinModal } from '../../components/users/ResetPinModal';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import type { User, Invoice, Payment } from '../../../main/database/schema';
import type { UserFormData } from '../../utils/schemas';
import { notifications } from '@mantine/notifications';
import numeral from 'numeral';

interface UserDetailPageProps {
  id?: string;
}

export function UserDetailPage({ id: propId }: UserDetailPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const { openTab, closeTab, activeTabId } = useTabManager();
  const isNew = id === 'new';

  const { getById, create, update } = useUsers();
  const { invoices } = useInvoices();
  const { payments } = usePayments();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [editModalOpened, setEditModalOpened] = useState(isNew);
  const [resetPinModalOpened, setResetPinModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter invoices and payments by user
  const userInvoices = useMemo(() => {
    if (!user || !Array.isArray(invoices)) return [];
    return invoices.filter((inv) => inv.userId === user.id);
  }, [invoices, user]);

  const userPayments = useMemo(() => {
    if (!user || !Array.isArray(payments)) return [];
    return payments.filter((pay) => pay.userId === user.id);
  }, [payments, user]);

  // Column definitions for invoices
  const invoiceColumns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        title: 'Invoice #',
        sortable: true,
      },
      {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (_value, invoice) => (
          <Badge
            color={
              invoice.status === 'PAID'
                ? 'green'
                : invoice.status === 'PARTIAL'
                  ? 'yellow'
                  : invoice.status === 'CANCELLED'
                    ? 'red'
                    : 'blue'
            }
          >
            {invoice.status}
          </Badge>
        ),
      },
      {
        key: 'total',
        title: 'Total',
        sortable: true,
        render: (_value, invoice) => numeral(invoice.total).format('$0,0.00'),
      },
      {
        key: 'amountPaid',
        title: 'Paid',
        sortable: true,
        render: (_value, invoice) => numeral(invoice.amountPaid).format('$0,0.00'),
      },
      {
        key: 'createdAt',
        title: 'Date',
        sortable: true,
        render: (_value, invoice) =>
          invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : 'N/A',
      },
    ],
    []
  );

  // Column definitions for payments
  const paymentColumns: ColumnDef<Payment>[] = useMemo(
    () => [
      {
        key: 'id',
        title: 'Payment #',
        sortable: true,
      },
      {
        key: 'invoiceId',
        title: 'Invoice ID',
        sortable: true,
      },
      {
        key: 'amount',
        title: 'Amount',
        sortable: true,
        render: (_value, payment) => numeral(payment.amount).format('$0,0.00'),
      },
      {
        key: 'paidAt',
        title: 'Date',
        sortable: true,
        render: (_value, payment) =>
          payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'N/A',
      },
    ],
    []
  );

  useEffect(() => {
    const loadUser = async () => {
      if (isNew) return;

      try {
        setLoading(true);
        const data = await getById(parseInt(id!));
        setUser(data);
      } catch (error) {
        console.error('Failed to load user:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load user',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id, isNew, getById]);

  const goToUsersList = () => {
    if (activeTabId) {
      closeTab(activeTabId, true);
    }
    openTab({
      type: 'users-list',
      path: '/users',
      title: 'Users',
      entityId: null,
    });
  };

  const handleSave = async (data: UserFormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const result = await create(data);
        // Close current "new" tab and open the created user
        if (activeTabId) {
          closeTab(activeTabId, true);
        }
        openTab({
          type: 'user-detail',
          path: `/users/${result.id}`,
          title: `${result.firstName} ${result.lastName}`,
          entityId: result.id.toString(),
        });
      } else {
        await update(parseInt(id!), data);
        const updated = await getById(parseInt(id!));
        setUser(updated);
        setEditModalOpened(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!user && !isNew) {
    return (
      <Paper p="xl">
        <Text>User not found</Text>
        <Button onClick={goToUsersList} mt="md">
          Back to Users
        </Button>
      </Paper>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={goToUsersList}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New User' : `${user?.firstName} ${user?.lastName}`}
          </Title>
          {!isNew && user && !user.active && (
            <Badge color="gray" size="lg">
              Inactive
            </Badge>
          )}
        </Group>
        {!isNew && (
          <Group>
            <Button
              variant="light"
              leftSection={<IconKey size={16} />}
              onClick={() => setResetPinModalOpened(true)}
            >
              Reset PIN
            </Button>
            <Button leftSection={<IconEdit size={16} />} onClick={() => setEditModalOpened(true)}>
              Edit
            </Button>
          </Group>
        )}
      </Group>

      {!isNew && user && (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Username
              </Text>
              <Text fw={500}>{user.username}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Email
              </Text>
              <Text fw={500}>{user.email || 'N/A'}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Job Title
              </Text>
              <Text fw={500}>{user.title || 'N/A'}</Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Role
              </Text>
              <Text fw={500}>
                {
                  { 1: 'Admin', 2: 'Manager', 3: 'Cashier', 4: 'User' }[user.roleId || 4]
                }
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Department
              </Text>
              <Text fw={500}>{user.department || 'N/A'}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Phone
              </Text>
              <Text fw={500}>{user.phone || 'N/A'}</Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Start Date
              </Text>
              <Text fw={500}>
                {user.startDate ? new Date(user.startDate).toLocaleDateString() : 'N/A'}
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                End Date
              </Text>
              <Text fw={500}>
                {user.endDate ? new Date(user.endDate).toLocaleDateString() : 'Active'}
              </Text>
            </Paper>
          </SimpleGrid>

          <Tabs defaultValue="invoices" mt="md">
            <Tabs.List>
              <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
                Invoices ({userInvoices.length})
              </Tabs.Tab>
              <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
                Payments ({userPayments.length})
              </Tabs.Tab>
              <Tabs.Tab value="activity" leftSection={<IconHistory size={16} />}>
                Activity
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="invoices" pt="md">
              <DataTable
                data={userInvoices}
                columns={invoiceColumns}
                pagination
                pageSize={10}
                searchable
                searchPlaceholder="Search invoices..."
                emptyMessage="No invoices processed by this user"
                onRowClick={(invoice) =>
                  openTab({
                    type: 'invoice-editor',
                    path: `/invoices/${invoice.id}`,
                    title: `Invoice ${invoice.invoiceNumber}`,
                    entityId: invoice.id.toString(),
                  })
                }
              />
            </Tabs.Panel>

            <Tabs.Panel value="payments" pt="md">
              <DataTable
                data={userPayments}
                columns={paymentColumns}
                pagination
                pageSize={10}
                searchable
                searchPlaceholder="Search payments..."
                emptyMessage="No payments processed by this user"
              />
            </Tabs.Panel>

            <Tabs.Panel value="activity" pt="md">
              <Paper withBorder p="xl">
                <Stack align="center" gap="md">
                  <IconHistory size={48} stroke={1.5} color="gray" />
                  <Text c="dimmed">Activity logs will be displayed here</Text>
                </Stack>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        </>
      )}

      <Modal
        opened={editModalOpened}
        onClose={() => {
          if (isNew) {
            goToUsersList();
          } else {
            setEditModalOpened(false);
          }
        }}
        title={isNew ? 'Create User' : 'Edit User'}
        size="lg"
      >
        <UserForm
          user={user}
          onSubmit={handleSave}
          onCancel={() => {
            if (isNew) {
              goToUsersList();
            } else {
              setEditModalOpened(false);
            }
          }}
          loading={saving}
        />
      </Modal>

      {user && (
        <ResetPinModal
          opened={resetPinModalOpened}
          onClose={() => setResetPinModalOpened(false)}
          user={user}
          onReset={async () => {
            // Refresh user data after PIN reset
            const updated = await getById(user.id);
            setUser(updated);
          }}
        />
      )}
    </Stack>
  );
}
