import { useParams, useNavigate } from 'react-router-dom';
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
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconKey } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useEmployees } from '../../hooks';
import { EmployeeForm } from '../../components/forms/EmployeeForm';
import type { Employee } from '../../../main/database/schema';
import type { EmployeeFormData } from '../../utils/schemas';
import { notifications } from '@mantine/notifications';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { getById, create, update } = useEmployees();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [editModalOpened, setEditModalOpened] = useState(isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadEmployee = async () => {
      if (isNew) return;

      try {
        setLoading(true);
        const data = await getById(parseInt(id!));
        setEmployee(data);
      } catch (error) {
        console.error('Failed to load employee:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load employee',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [id, isNew, getById]);

  const handleSave = async (data: EmployeeFormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const result = await create(data);
        navigate(`/employees/${result.id}`);
      } else {
        await update(parseInt(id!), data);
        const updated = await getById(parseInt(id!));
        setEmployee(updated);
        setEditModalOpened(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!employee && !isNew) {
    return (
      <Paper p="xl">
        <Text>Employee not found</Text>
        <Button onClick={() => navigate('/employees')} mt="md">
          Back to Employees
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
            onClick={() => navigate('/employees')}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New Employee' : `${employee?.firstName} ${employee?.lastName}`}
          </Title>
          {!isNew && employee && (
            <>
              {employee.usingDefaultPin && (
                <Badge color="orange" size="lg">
                  Using Default PIN
                </Badge>
              )}
              {employee.endDate && (
                <Badge color="gray" size="lg">
                  Inactive
                </Badge>
              )}
            </>
          )}
        </Group>
        {!isNew && (
          <Group>
            <Button
              variant="light"
              leftSection={<IconKey size={16} />}
              onClick={() => {
                // Reset PIN functionality
                notifications.show({
                  title: 'Feature Coming Soon',
                  message: 'PIN reset functionality will be implemented',
                  color: 'blue',
                });
              }}
            >
              Reset PIN
            </Button>
            <Button leftSection={<IconEdit size={16} />} onClick={() => setEditModalOpened(true)}>
              Edit
            </Button>
          </Group>
        )}
      </Group>

      {!isNew && employee && (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Username
              </Text>
              <Text fw={500}>{employee.username}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Job Title
              </Text>
              <Text fw={500}>{employee.title || 'N/A'}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Role
              </Text>
              <Text fw={500}>
                {
                  { 1: 'Admin', 2: 'Manager', 3: 'Cashier', 4: 'User' }[employee.roleId || 4]
                }
              </Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Start Date
              </Text>
              <Text fw={500}>
                {employee.startDate ? new Date(employee.startDate).toLocaleDateString() : 'N/A'}
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                End Date
              </Text>
              <Text fw={500}>
                {employee.endDate ? new Date(employee.endDate).toLocaleDateString() : 'Active'}
              </Text>
            </Paper>
          </SimpleGrid>
        </>
      )}

      <Modal
        opened={editModalOpened}
        onClose={() => {
          if (isNew) {
            navigate('/employees');
          } else {
            setEditModalOpened(false);
          }
        }}
        title={isNew ? 'Create Employee' : 'Edit Employee'}
        size="lg"
      >
        <EmployeeForm
          employee={employee}
          onSubmit={handleSave}
          onCancel={() => {
            if (isNew) {
              navigate('/employees');
            } else {
              setEditModalOpened(false);
            }
          }}
          loading={saving}
        />
      </Modal>
    </Stack>
  );
}
