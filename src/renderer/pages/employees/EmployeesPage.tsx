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
  Checkbox,
  Select,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconRefresh,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column } from '../../components/common/DataTable';
import { PermissionButton } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';

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
  roleId: number | null;
  startDate: string | null;
  createdAt: Date;
}

interface Role {
  id: number;
  name: string;
  isSuperAdmin: boolean;
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
  const { replaceCurrentTab } = useTabContext();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const pageSize = 20;

  // Load roles once for the filter dropdown and role-name lookup.
  useEffect(() => {
    window.electron.invoke(IpcChannel.GET_ROLES).then((result) => {
      if (result.success && result.data) setRoles(result.data);
    });
  }, []);

  const roleNameById = useMemo(() => {
    const map = new Map<number, Role>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEES_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
        activeOnly,
        roleId: roleFilter ? parseInt(roleFilter, 10) : null,
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
  }, [page, pageSize, debouncedSearch, activeOnly, roleFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeOnly, roleFilter]);

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

  const getEmployeeName = (employee: Employee) => employeeDisplayName(employee);

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
        key: 'role',
        header: 'Role',
        render: (employee) => {
          const role = employee.roleId != null ? roleNameById.get(employee.roleId) : null;
          if (!role) {
            return (
              <Text size="sm" c="dimmed">
                No role
              </Text>
            );
          }
          return (
            <Badge color={role.isSuperAdmin ? 'orange' : 'blue'} variant="light" size="sm">
              {role.name}
            </Badge>
          );
        },
      },
    ],
    [roleNameById]
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
        <Title order={2}>Employees</Title>
        <PermissionButton
          permission="CREATE_EMPLOYEE"
          whenDenied="disable"
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/employees/new')}
        >
          Add Employee
        </PermissionButton>
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
            <Select
              placeholder="All roles"
              value={roleFilter}
              onChange={setRoleFilter}
              data={roles.map((r) => ({ value: String(r.id), label: r.name }))}
              clearable
              w={200}
            />
            <Checkbox
              label="Active only"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
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
            onRowClick={(employee) => replaceCurrentTab(`/employees/${employee.id}`)}
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
