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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconShield,
  IconShieldCheck,
  IconPencil,
  IconKey,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { getPermissionByCode } from '../../../shared/constants/permissions';
import { CopyButton } from '../../components/common';
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
  const navigate = useNavigate();
  const { id } = useTabParams<{ id: string }>();
  const { replaceCurrentTab } = useTabContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [newCode, setNewCode] = useState<string | null>(null);

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

  const doResetAccessCode = async () => {
    if (!employee) return;
    setResetting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.RESET_EMPLOYEE_ACCESS_CODE, { id: employee.id });
      if (result.success && result.data?.code) {
        setEmployee((prev) => (prev ? { ...prev, code: result.data.code } : null));
        setNewCode(result.data.code);
        notifications.show({
          title: 'Access Code Reset',
          message: 'A new access code has been generated',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({ title: 'Error', message: result.error || 'Failed to reset access code', color: 'red' });
      }
    } catch (err) {
      notifications.show({ title: 'Error', message: err instanceof Error ? err.message : 'An error occurred', color: 'red' });
    } finally {
      setResetting(false);
    }
  };

  const confirmResetAccessCode = () => {
    if (!employee) return;
    const name = employeeDisplayName(employee);
    modals.openConfirmModal({
      title: 'Reset Access Code',
      children: (
        <Text size="sm">
          Generate a new access code for <strong>{name}</strong>? Their current code will stop working immediately.
        </Text>
      ),
      labels: { confirm: 'Reset & Generate', cancel: 'Cancel' },
      confirmProps: { color: 'orange' },
      onConfirm: doResetAccessCode,
    });
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
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => replaceCurrentTab('/employees')}>
          Back to Employees
        </Button>
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
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => replaceCurrentTab(`/employees/${employee.id}`)}>
            Back
          </Button>
          <Stack gap={4}>
            <Group gap="sm">
              <IconShield size={24} />
              <Title order={2}>Assign Role</Title>
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
              onClick={() => navigate('/roles')}
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

      {/* Access Code */}
      <Paper p="lg" radius="md" withBorder>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" color="grape" size="lg" radius="md">
              <IconKey size={18} />
            </ThemeIcon>
            <Stack gap={2}>
              <Text fw={500} size="sm">
                Access Code
              </Text>
              <Text size="xs" c="dimmed">
                A private credential for PIN verification and one-time authorisations. Reset to generate a new one.
              </Text>
            </Stack>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Badge size="lg" variant="light" color="grape" style={{ fontFamily: 'monospace', letterSpacing: 2 }}>
              ••••••
            </Badge>
            <PermissionButton
              permission="RESET_EMPLOYEE_PASSWORD"
              whenDenied="elevate"
              actionLabel={`Reset access code for ${employeeName}`}
              context={{ entity: 'employee', id: employee.id }}
              variant="light"
              color="orange"
              leftSection={<IconRefresh size={16} />}
              loading={resetting}
              onClick={confirmResetAccessCode}
            >
              Reset Access Code
            </PermissionButton>
          </Group>
        </Group>
      </Paper>

      {/* Newly generated code */}
      <Modal opened={!!newCode} onClose={() => setNewCode(null)} title="New Access Code" centered>
        <Stack align="center" gap="md" py="sm">
          <Text size="sm" c="dimmed" ta="center">
            Share this new access code with the employee. Their previous code no longer works.
          </Text>
          <Group gap="xs" align="center">
            <Title order={1} style={{ fontFamily: 'monospace', letterSpacing: 4 }}>
              {newCode}
            </Title>
            {newCode && <CopyButton value={newCode} size="md" tooltip="Copy access code" />}
          </Group>
          <Button onClick={() => setNewCode(null)}>Done</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
