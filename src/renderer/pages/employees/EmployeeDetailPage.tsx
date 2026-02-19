import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Tabs,
  Loader,
  Alert,
  SimpleGrid,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft,
  IconEdit,
  IconShield,
  IconAlertCircle,
  IconFileInvoice,
  IconFileDescription,
  IconReceipt,
  IconCreditCard,
  IconClock,
  IconChartBar,
  IconChevronDown,
  IconUserCheck,
  IconUserOff,
  IconUserX,
  IconTrash,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { EmployeeSummaryTab } from './tabs/EmployeeSummaryTab';
import { EmployeeInvoicesTab } from './tabs/EmployeeInvoicesTab';
import { EmployeeQuotationsTab } from './tabs/EmployeeQuotationsTab';
import { EmployeeCreditNotesTab } from './tabs/EmployeeCreditNotesTab';
import { EmployeePaymentsTab } from './tabs/EmployeePaymentsTab';
import { EmployeeAttendanceTab } from './tabs/EmployeeAttendanceTab';

interface Employee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  address: string | null;
  phone: string | null;
  emergencyContact: string | null;
  username: string | null;
  status: string | null;
  isSalesperson: boolean | null;
  commission: string | null;
  startDate: string | null;
  createdAt: Date;
}

export function EmployeeDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle } = useTabContext();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('summary');
  const [statusUpdating, setStatusUpdating] = useState(false);

  const employeeId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (employeeId) loadEmployee(employeeId);
  }, [employeeId]);

  useEffect(() => {
    if (employee && location.pathname === `/employees/${id}`) {
      const name = employee.firstName || employee.lastName
        ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
        : employee.code;
      updateTabTitle(location.pathname, name);
    }
  }, [employee, id, location.pathname, updateTabTitle]);

  const loadEmployee = async (empId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: empId });
      if (result.success && result.data) {
        setEmployee(result.data);
      } else {
        setError(result.error || 'Failed to load employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!employee) return;
    setStatusUpdating(true);
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE, {
        id: employee.id,
        data: { status: newStatus },
      });
      if (result.success) {
        setEmployee({ ...employee, status: newStatus });
        notifications.show({
          title: 'Status Updated',
          message: `Employee status changed to ${newStatus}`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Update Failed',
          message: result.error || 'Failed to update status',
          color: 'red',
        });
      }
    } catch {
      notifications.show({ title: 'Error', message: 'An unexpected error occurred', color: 'red' });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = () => {
    console.log("Button was clicked to delete", employee);
    if (!employee) return;
    const name = employee.firstName || employee.lastName
      ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
      : employee.code;

      console.log(name);
    modals.openConfirmModal({
      title: 'Delete Employee',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.DELETE_EMPLOYEE, { id: employee.id });
          if (result.success) {
            notifications.show({ title: 'Deleted', message: `${name} has been deleted`, color: 'green' });
            navigate('/employees');
          } else {
            notifications.show({ title: 'Delete Failed', message: result.error || 'Failed to delete employee', color: 'red' });
          }
        } catch {
          notifications.show({ title: 'Error', message: 'An unexpected error occurred', color: 'red' });
        }
      },
    });

    console.log('Dialog should be open');
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'suspended': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading employee...</Text>
      </Stack>
    );
  }

  if (error || !employee) {
    return (
      <Stack p="xl" gap="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/employees')}
        >
          Back to Employees
        </Button>
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Employee not found'}
        </Alert>
      </Stack>
    );
  }

  const employeeName = employee.firstName || employee.lastName
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    : employee.code;

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/employees')}
          >
            Back
          </Button>
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{employeeName}</Title>
              <Badge color={getStatusColor(employee.status)} variant="light">
                {employee.status || 'Unknown'}
              </Badge>
              {employee.isSalesperson && (
                <Badge color="violet" variant="light">Salesperson</Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              Code: {employee.code} {employee.username && `| Username: ${employee.username}`}
            </Text>
          </Stack>
        </Group>
        <Group>
          <Menu shadow="md" position="bottom-end">
            <Menu.Target>
              <Button
                variant="outline"
                color={getStatusColor(employee.status)}
                rightSection={<IconChevronDown size={14} />}
                loading={statusUpdating}
              >
                Status
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {employee.status !== 'active' && (
                <Menu.Item
                  leftSection={<IconUserCheck size={14} />}
                  color="green"
                  onClick={() => handleStatusChange('active')}
                >
                  Set Active
                </Menu.Item>
              )}
              {employee.status !== 'inactive' && (
                <Menu.Item
                  leftSection={<IconUserOff size={14} />}
                  onClick={() => handleStatusChange('inactive')}
                >
                  Set Inactive
                </Menu.Item>
              )}
              {employee.status !== 'suspended' && (
                <Menu.Item
                  leftSection={<IconUserX size={14} />}
                  color="red"
                  onClick={() => handleStatusChange('suspended')}
                >
                  Suspend
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="outline"
            leftSection={<IconShield size={16} />}
            onClick={() => navigate(`/employees/${employee.id}/permissions`)}
          >
            Permissions
          </Button>
          <Button
            leftSection={<IconEdit size={16} />}
            onClick={() => navigate(`/employees/${employee.id}/edit`)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleDelete}
          >
            Delete
          </Button>
        </Group>
      </Group>

      {/* Employee Info Card */}
      <Paper p="lg" radius="md" withBorder>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Title</Text>
            <Text fw={500}>{employee.title || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Department</Text>
            <Text fw={500}>{employee.department || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Phone</Text>
            <Text fw={500}>{employee.phone || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Start Date</Text>
            <Text fw={500}>{employee.startDate || '-'}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Activity Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="summary" leftSection={<IconChartBar size={16} />}>Summary</Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>Invoices</Tabs.Tab>
          <Tabs.Tab value="quotations" leftSection={<IconFileDescription size={16} />}>Quotations</Tabs.Tab>
          <Tabs.Tab value="creditNotes" leftSection={<IconReceipt size={16} />}>Credit Notes</Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCreditCard size={16} />}>Payments</Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconClock size={16} />}>Attendance</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="summary" pt="md">
          <EmployeeSummaryTab employeeId={employee.id} isActive={activeTab === 'summary'} />
        </Tabs.Panel>
        <Tabs.Panel value="invoices" pt="md">
          <EmployeeInvoicesTab employeeId={employee.id} isActive={activeTab === 'invoices'} />
        </Tabs.Panel>
        <Tabs.Panel value="quotations" pt="md">
          <EmployeeQuotationsTab employeeId={employee.id} isActive={activeTab === 'quotations'} />
        </Tabs.Panel>
        <Tabs.Panel value="creditNotes" pt="md">
          <EmployeeCreditNotesTab employeeId={employee.id} isActive={activeTab === 'creditNotes'} />
        </Tabs.Panel>
        <Tabs.Panel value="payments" pt="md">
          <EmployeePaymentsTab employeeId={employee.id} isActive={activeTab === 'payments'} />
        </Tabs.Panel>
        <Tabs.Panel value="attendance" pt="md">
          <EmployeeAttendanceTab employeeId={employee.id} isActive={activeTab === 'attendance'} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}