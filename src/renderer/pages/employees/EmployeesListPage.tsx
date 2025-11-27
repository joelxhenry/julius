import { Title, Group, Button, Stack, Badge } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconUsers } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { useEmployees } from '../../hooks';
import type { Employee } from '../../../main/database/schema';

export function EmployeesListPage() {
  const navigate = useNavigate();
  const { employees, loading } = useEmployees();

  const columns: ColumnDef<Employee>[] = [
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
        // Map role IDs to names (you'd fetch this from roles table)
        const roleNames: Record<number, string> = {
          1: 'Admin',
          2: 'Manager',
          3: 'Cashier',
        };
        return roleNames[value as number] || 'User';
      },
    },
    {
      key: 'usingDefaultPin',
      title: 'PIN Status',
      render: (value) => (
        <Badge color={value ? 'orange' : 'green'} size="sm">
          {value ? 'Default PIN' : 'Custom PIN'}
        </Badge>
      ),
    },
    {
      key: 'endDate',
      title: 'Status',
      render: (value) => (
        <Badge color={value ? 'gray' : 'green'} size="sm">
          {value ? 'Inactive' : 'Active'}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconUsers size={32} />
          <Title order={2}>Employees</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/employees/new')}
        >
          New Employee
        </Button>
      </Group>

      <DataTable
        data={employees}
        columns={columns}
        loading={loading}
        onRowClick={(employee) => navigate(`/employees/${employee.id}`)}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
