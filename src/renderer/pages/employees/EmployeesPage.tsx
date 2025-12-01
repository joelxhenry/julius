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
  IconShield,
  IconUserOff,
  IconUserCheck,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column } from '../../components/common/DataTable';

interface Employee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  username: string | null;
  status: string | null;
  isSalesperson: boolean | null;
  startDate: string | null;
  createdAt: Date;
}

interface PaginatedResult {
  data: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);
  const [salespersonOnly, setSalespersonOnly] = useState(false);

  const pageSize = 20;

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEES_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
        activeOnly,
        salespersonOnly,
      });

      if (result.success && result.data) {
        const paginatedResult = result.data as PaginatedResult;
        setEmployees(paginatedResult.data);
        setTotal(paginatedResult.total);
        setTotalPages(paginatedResult.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, activeOnly, salespersonOnly]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeOnly, salespersonOnly]);

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'suspended':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getEmployeeName = (employee: Employee) => {
    if (employee.firstName || employee.lastName) {
      return `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
    }
    return employee.code;
  };

  const columns: Column<Employee>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (employee) => getEmployeeName(employee),
      },
      {
        key: 'title',
        header: 'Title',
        accessor: 'title',
      },
      {
        key: 'department',
        header: 'Department',
        accessor: 'department',
      },
      {
        key: 'status',
        header: 'Status',
        render: (employee) => (
          <Badge color={getStatusColor(employee.status)} variant="light" size="sm">
            {employee.status || 'Unknown'}
          </Badge>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        render: (employee) =>
          employee.isSalesperson ? (
            <Badge color="violet" variant="light" size="sm">
              Salesperson
            </Badge>
          ) : null,
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 100,
        render: (employee) => (
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="blue"
              onClick={() => navigate(`/employees/${employee.id}`)}
              title="View details"
            >
              <IconEye size={16} />
            </ActionIcon>
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={14} />}
                  onClick={() => navigate(`/employees/${employee.id}/edit`)}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconShield size={14} />}
                  onClick={() => navigate(`/employees/${employee.id}/permissions`)}
                >
                  Manage Permissions
                </Menu.Item>
                <Menu.Divider />
                {employee.status === 'active' ? (
                  <Menu.Item leftSection={<IconUserOff size={14} />} color="red">
                    Deactivate
                  </Menu.Item>
                ) : (
                  <Menu.Item leftSection={<IconUserCheck size={14} />} color="green">
                    Activate
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        ),
      },
    ],
    [navigate]
  );

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Employees</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/employees/new')}>
          Add Employee
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          {/* Filters */}
          <Group gap="md">
            <TextInput
              placeholder="Search employees..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Checkbox
              label="Active only"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            <Checkbox
              label="Salespeople only"
              checked={salespersonOnly}
              onChange={(e) => setSalespersonOnly(e.target.checked)}
            />
            <ActionIcon variant="subtle" onClick={fetchEmployees} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Results count */}
          <Text size="sm" c="dimmed">
            {total} employee{total !== 1 ? 's' : ''} found
          </Text>

          {/* Table */}
          <DataTable
            columns={columns}
            data={employees}
            loading={loading}
            keyField="id"
            onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
            emptyMessage="No employees found"
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
