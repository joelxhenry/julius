import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Select,
  Loader,
  Alert,
  Divider,
  ThemeIcon,
  SimpleGrid,
  Modal,
  PasswordInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconShield,
  IconShieldCheck,
  IconPencil,
  IconLock,
} from '@tabler/icons-react';
import { useTabParams } from '../../hooks/useTabParams';
import { useContentNavigation } from '../../hooks/useContentNavigation';
import { BackButton } from '../../components/common';
import { IpcChannel } from '../../../shared/types/ipc';
import { getPermissionByCode } from '../../../shared/constants/permissions';
import { PermissionButton } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';

interface Employee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  status: string | null;
  roleId: number | null;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
  permissions: Record<string, boolean>;
  isSuperAdmin: boolean;
}

export function EmployeePermissionsPage() {
  const { id } = useTabParams<{ id: string }>();
  const { bind } = useContentNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [passwordModalOpened, setPasswordModalOpened] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const passwordForm = useForm<{ newPassword: string; confirmPassword: string }>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: {
      newPassword: (value) => (value.length < 4 ? 'Password must be at least 4 characters' : null),
      confirmPassword: (value, values) => (value !== values.newPassword ? 'Passwords do not match' : null),
    },
  });

  useEffect(() => {
    if (id) load(parseInt(id, 10));
  }, [id]);

  const load = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const [empResult, rolesResult] = await Promise.all([
        window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: employeeId }),
        window.electron.invoke(IpcChannel.GET_ROLES),
      ]);
      if (empResult.success && empResult.data) {
        setEmployee(empResult.data);
        setSelectedRoleId(empResult.data.roleId ? String(empResult.data.roleId) : null);
      } else {
        setError(empResult.error || 'Failed to load employee');
      }
      if (rolesResult.success && rolesResult.data) {
        setRoles(rolesResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = roles.find((r) => String(r.id) === selectedRoleId) || null;

  const handleSave = async () => {
    if (!employee) return;
    setSaving(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.ASSIGN_EMPLOYEE_ROLE, {
        id: employee.id,
        roleId: selectedRoleId ? parseInt(selectedRoleId, 10) : null,
      });
      if (result.success) {
        notifications.show({
          title: 'Role Assigned',
          message: 'The employee’s role has been updated',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setHasChanges(false);
        setEmployee((prev) => (prev ? { ...prev, roleId: selectedRoleId ? parseInt(selectedRoleId, 10) : null } : null));
      } else {
        setError(result.error || 'Failed to assign role');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPassword = async (values: { newPassword: string; confirmPassword: string }) => {
    if (!employee) return;
    setSettingPassword(true);
    setPasswordError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PASSWORD, {
        id: employee.id,
        newPassword: values.newPassword,
      });
      if (result.success) {
        notifications.show({
          title: 'Password Reset',
          message: `A new login password has been set for ${employeeDisplayName(employee)}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setPasswordModalOpened(false);
        passwordForm.reset();
      } else {
        setPasswordError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSettingPassword(false);
    }
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading...</Text>
      </Stack>
    );
  }

  if (error || !employee) {
    return (
      <Stack p="xl" gap="lg">
        <BackButton fallbackPath="/employees" label="Back to Employees" />
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Employee not found'}
        </Alert>
      </Stack>
    );
  }

  const employeeName = employeeDisplayName(employee);

  const grantedCodes = selectedRole
    ? Object.entries(selectedRole.permissions || {})
        .filter(([, v]) => v)
        .map(([code]) => code)
    : [];

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group>
          <BackButton fallbackPath={`/employees/${employee.id}`} label="Back" />
          <Stack gap={4}>
            <Group gap="sm">
              <IconShield size={24} />
              <Title order={2}>Security Settings</Title>
            </Group>
            <Text c="dimmed" size="sm">
              {employeeName}
              {employee.username ? ` · ${employee.username}` : ''}
            </Text>
          </Stack>
        </Group>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={saving}
          disabled={!hasChanges}
        >
          Save Changes
        </Button>
      </Group>

      {hasChanges && (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
          You have unsaved changes
        </Alert>
      )}

      {/* Role selection */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-end">
            <Select
              label="Role"
              description="Permissions are inherited from the assigned role"
              placeholder="No role (no access)"
              value={selectedRoleId}
              onChange={(value) => {
                setSelectedRoleId(value);
                setHasChanges(true);
              }}
              data={roles.map((r) => ({ value: String(r.id), label: r.isSuperAdmin ? `${r.name} (Full access)` : r.name }))}
              clearable
              style={{ flex: 1, maxWidth: 420 }}
            />
            <Button
              variant="light"
              leftSection={<IconPencil size={16} />}
              {...bind('/roles')}
            >
              Manage Roles
            </Button>
          </Group>

          {selectedRole && (
            <>
              <Divider />
              {selectedRole.isSuperAdmin ? (
                <Alert icon={<IconShieldCheck size={16} />} color="orange" variant="light">
                  <Text fw={500}>{selectedRole.name} — Full access</Text>
                  <Text size="sm" c="dimmed">
                    This role grants unrestricted access to every feature.
                  </Text>
                </Alert>
              ) : (
                <Stack gap="xs">
                  <Group gap="xs">
                    <ThemeIcon variant="light" size="sm" color="blue">
                      <IconShield size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500}>
                      Grants {grantedCodes.length} permission(s)
                    </Text>
                  </Group>
                  {selectedRole.description && (
                    <Text size="sm" c="dimmed">
                      {selectedRole.description}
                    </Text>
                  )}
                  <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs" mt="xs">
                    {grantedCodes.map((code) => (
                      <Badge key={code} variant="light" color="blue" size="sm" style={{ justifyContent: 'flex-start' }}>
                        {getPermissionByCode(code)?.label ?? code}
                      </Badge>
                    ))}
                  </SimpleGrid>
                </Stack>
              )}
            </>
          )}

          {!selectedRole && (
            <Text size="sm" c="dimmed">
              No role assigned — this employee has no permissions.
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Login Password */}
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="grape" size="lg" radius="md">
              <IconLock size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={500} size="sm">
                Login Password
              </Text>
              <Text size="xs" c="dimmed">
                This employee&apos;s login password. Resetting sets a new one immediately.
              </Text>
            </Stack>
          </Group>
          <PermissionButton
            permission="RESET_EMPLOYEE_PASSWORD"
            whenDenied="elevate"
            actionLabel={`Reset password for ${employeeName}`}
            context={{ entity: 'employee', id: employee.id }}
            variant="light"
            color="orange"
            leftSection={<IconLock size={16} />}
            onClick={() => {
              passwordForm.reset();
              setPasswordError(null);
              setPasswordModalOpened(true);
            }}
          >
            Reset Password
          </PermissionButton>
        </Group>
      </Paper>

      {/* Reset login password */}
      <Modal
        opened={passwordModalOpened}
        onClose={() => setPasswordModalOpened(false)}
        title={
          <Group gap="xs">
            <IconShield size={18} />
            <Text fw={600}>Reset Login Password</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={passwordForm.onSubmit(handleSetPassword)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Set a new login password for <strong>{employeeName}</strong>. Their previous password will stop working immediately.
            </Text>

            {passwordError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {passwordError}
              </Alert>
            )}

            <PasswordInput
              label="New Password"
              placeholder="Enter a password"
              leftSection={<IconLock size={16} />}
              required
              {...passwordForm.getInputProps('newPassword')}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Re-enter the password"
              leftSection={<IconLock size={16} />}
              required
              {...passwordForm.getInputProps('confirmPassword')}
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setPasswordModalOpened(false)}>
                Cancel
              </Button>
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={settingPassword}>
                Reset Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
