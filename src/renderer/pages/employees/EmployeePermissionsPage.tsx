import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Switch,
  Loader,
  Alert,
  Accordion,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconShield,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';
import {
  PERMISSION_CATEGORIES,
  getPermissionsByCategory,
  PermissionDefinition,
  PermissionCategory,
} from '../../../shared/constants/permissions';

interface Employee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  status: string | null;
  permissions: Record<string, boolean>;
}

export function EmployeePermissionsPage() {
  const navigate = useNavigate();
  const { id } = useTabParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const permissionsByCategory = getPermissionsByCategory();

  useEffect(() => {
    if (id) {
      loadEmployee(parseInt(id, 10));
    }
  }, [id]);

  const loadEmployee = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: employeeId });
      if (result.success && result.data) {
        setEmployee(result.data);
        setPermissions(result.data.permissions || {});
      } else {
        setError(result.error || 'Failed to load employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (code: string, enabled: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [code]: enabled,
    }));
    setHasChanges(true);
  };

  const handleCategoryToggle = (category: PermissionCategory, enabled: boolean) => {
    const categoryPermissions = permissionsByCategory[category];
    setPermissions((prev) => {
      const updated = { ...prev };
      categoryPermissions.forEach((p) => {
        updated[p.code] = enabled;
      });
      return updated;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!employee) return;

    setSaving(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PERMISSIONS, {
        id: employee.id,
        permissions,
      });

      if (result.success) {
        notifications.show({
          title: 'Permissions Updated',
          message: 'Employee permissions have been updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setHasChanges(false);
        setEmployee((prev) => prev ? { ...prev, permissions } : null);
      } else {
        setError(result.error || 'Failed to update permissions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (employee) {
      setPermissions(employee.permissions || {});
      setHasChanges(false);
    }
  };

  const isCategoryEnabled = (category: PermissionCategory) => {
    const categoryPermissions = permissionsByCategory[category];
    return categoryPermissions.every((p) => permissions[p.code]);
  };

  const isCategoryPartial = (category: PermissionCategory) => {
    const categoryPermissions = permissionsByCategory[category];
    const enabledCount = categoryPermissions.filter((p) => permissions[p.code]).length;
    return enabledCount > 0 && enabledCount < categoryPermissions.length;
  };

  const getEnabledCount = (category: PermissionCategory) => {
    const categoryPermissions = permissionsByCategory[category];
    return categoryPermissions.filter((p) => permissions[p.code]).length;
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading permissions...</Text>
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
            onClick={() => navigate(`/employees/${employee.id}`)}
          >
            Back
          </Button>
          <Stack gap={4}>
            <Group gap="sm">
              <IconShield size={24} />
              <Title order={2}>Manage Permissions</Title>
            </Group>
            <Text c="dimmed" size="sm">
              {employeeName} ({employee.code})
            </Text>
          </Stack>
        </Group>
        <Group>
          {hasChanges && (
            <Button
              variant="subtle"
              onClick={handleReset}
            >
              Reset
            </Button>
          )}
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            Save Changes
          </Button>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {hasChanges && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
          You have unsaved changes
        </Alert>
      )}

      {/* Permissions Accordion */}
      <Accordion multiple defaultValue={PERMISSION_CATEGORIES.slice()} variant="separated">
        {PERMISSION_CATEGORIES.map((category) => {
          const categoryPerms = permissionsByCategory[category];
          const enabledCount = getEnabledCount(category);
          const isAllEnabled = isCategoryEnabled(category);
          const isPartial = isCategoryPartial(category);

          return (
            <Accordion.Item key={category} value={category}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" pr="md">
                  <Group gap="sm">
                    {isAllEnabled ? (
                      <IconShieldCheck size={20} color="var(--mantine-color-green-6)" />
                    ) : (
                      <IconShield size={20} color={isPartial ? 'var(--mantine-color-yellow-6)' : 'var(--mantine-color-gray-5)'} />
                    )}
                    <Text fw={500}>{category}</Text>
                  </Group>
                  <Badge
                    color={isAllEnabled ? 'green' : isPartial ? 'yellow' : 'gray'}
                    variant="light"
                    size="sm"
                  >
                    {enabledCount}/{categoryPerms.length}
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  {/* Category toggle */}
                  <Group justify="space-between" py="xs">
                    <Text size="sm" c="dimmed">
                      Enable all {category.toLowerCase()} permissions
                    </Text>
                    <Switch
                      checked={isAllEnabled}
                      onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                    />
                  </Group>
                  <Divider />

                  {/* Individual permissions */}
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    {categoryPerms.map((perm) => (
                      <Paper key={perm.code} p="sm" radius="md" withBorder>
                        <Group justify="space-between" wrap="nowrap">
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {perm.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {perm.description}
                            </Text>
                          </Stack>
                          <Switch
                            checked={!!permissions[perm.code]}
                            onChange={(e) => handlePermissionChange(perm.code, e.target.checked)}
                          />
                        </Group>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>

      {/* Actions */}
      <Group justify="flex-end">
        <Button
          variant="subtle"
          onClick={() => navigate(`/employees/${employee.id}`)}
        >
          Cancel
        </Button>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}
