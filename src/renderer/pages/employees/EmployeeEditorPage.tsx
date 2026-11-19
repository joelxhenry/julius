import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Textarea,
  Button,
  Select,
  NumberInput,
  Text,
  Loader,
  Alert,
  Modal,
  PasswordInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconUser,
  IconPhone,
  IconBriefcase,
  IconLock,
  IconShield,
} from '@tabler/icons-react';
import { useTabParams } from '../../hooks/useTabParams';
import { useContentNavigation } from '../../hooks/useContentNavigation';
import { BackButton } from '../../components/common';
import { IpcChannel } from '../../../shared/types/ipc';

interface EmployeeFormValues {
  code: string;
  firstName: string;
  lastName: string;
  title: string;
  department: string;
  address: string;
  phone: string;
  emergencyContact: string;
  startDate: Date | null;
  status: string;
  isSalesperson: boolean;
  commission: number | null;
  username: string;
  roleId: string | null;
}

interface PasswordSetupValues {
  newPassword: string;
  confirmPassword: string;
}

interface Role {
  id: number;
  name: string;
  isSuperAdmin: boolean;
}

export function EmployeeEditorPage() {
  const { go, bind } = useContentNavigation();
  const { id } = useTabParams<{ id: string }>();
  const isEditing = Boolean(id) && /^\d+$/.test(id!);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const [newEmployeeId, setNewEmployeeId] = useState<number | null>(null);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const form = useForm<EmployeeFormValues>({
    initialValues: {
      code: '',
      firstName: '',
      lastName: '',
      title: '',
      department: '',
      address: '',
      phone: '',
      emergencyContact: '',
      startDate: null,
      status: 'active',
      isSalesperson: true,
      commission: null,
      username: '',
      roleId: null,
    },
    validate: {
      code: (value) => (!value ? 'Employee code is required' : null),
      firstName: (value) => (!value ? 'First name is required' : null),
      lastName: (value) => (!value ? 'Last name is required' : null),
    },
  });

  const passwordForm = useForm<PasswordSetupValues>({
    initialValues: {
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value.length < 4 ? 'Password must be at least 4 characters' : null),
      confirmPassword: (value, values) => (value !== values.newPassword ? 'Passwords do not match' : null),
    },
  });

  useEffect(() => {
    if (isEditing && id) {
      loadEmployee(parseInt(id, 10));
    } else {
      // Generate a new employee code for new employees
      generateEmployeeCode();
    }
    window.electron.invoke(IpcChannel.GET_ROLES).then((result) => {
      if (result.success && result.data) setRoles(result.data);
    });
  }, [id, isEditing]);

  const generateEmployeeCode = async (isInitialLoad = true) => {
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GENERATE_EMPLOYEE_CODE);
      if (result.success && result.data?.code) {
        form.setFieldValue('code', result.data.code);
      } else {
        console.error('Failed to generate employee code:', result.error);
        setError(result.error || 'Failed to generate employee code');
      }
    } catch (err) {
      console.error('Failed to generate employee code:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate employee code');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const loadEmployee = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: employeeId });
      if (result.success && result.data) {
        const employee = result.data;
        form.setValues({
          code: employee.code || '',
          firstName: employee.firstName || '',
          lastName: employee.lastName || '',
          title: employee.title || '',
          department: employee.department || '',
          address: employee.address || '',
          phone: employee.phone || '',
          emergencyContact: employee.emergencyContact || '',
          startDate: employee.startDate ? new Date(employee.startDate) : null,
          status: employee.status || 'active',
          isSalesperson: employee.isSalesperson || false,
          commission: employee.commission ? parseFloat(employee.commission) : null,
          username: employee.username || '',
          roleId: employee.roleId != null ? String(employee.roleId) : null,
        });
      } else {
        setError(result.error || 'Failed to load employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: EmployeeFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        code: values.code,
        firstName: values.firstName || null,
        lastName: values.lastName || null,
        title: values.title || null,
        department: values.department || null,
        address: values.address || null,
        phone: values.phone || null,
        emergencyContact: values.emergencyContact || null,
        startDate: values.startDate ? values.startDate.toISOString().split('T')[0] : null,
        status: values.status,
        isSalesperson: values.isSalesperson,
        commission: values.commission?.toString() || null,
        username: values.username || null,
        roleId: values.roleId ? parseInt(values.roleId, 10) : null,
      };

      let result;
      if (isEditing && id) {
        result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE, {
          id: parseInt(id, 10),
          data,
        });
      } else {
        result = await window.electron.invoke(IpcChannel.CREATE_EMPLOYEE, data);
      }

      if (result.success) {
        notifications.show({
          title: isEditing ? 'Employee Updated' : 'Employee Created',
          message: `${values.firstName} ${values.lastName} has been ${isEditing ? 'updated' : 'created'} successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        if (!isEditing && result.data?.id) {
          // Prompt for a login password for the newly created employee instead
          // of navigating away immediately.
          setNewEmployeeId(result.data.id);
          setNewEmployeeName(`${values.firstName} ${values.lastName}`.trim());
          passwordForm.reset();
          setPasswordError(null);
        } else {
          go('/employees');
        }
      } else {
        setError(result.error || 'Failed to save employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPassword = async (values: PasswordSetupValues) => {
    if (!newEmployeeId) return;
    setSettingPassword(true);
    setPasswordError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PASSWORD, {
        id: newEmployeeId,
        newPassword: values.newPassword,
      });
      if (result.success) {
        notifications.show({
          title: 'Password Set',
          message: `A login password has been set for ${newEmployeeName}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setNewEmployeeId(null);
        go('/employees');
      } else {
        setPasswordError(result.error || 'Failed to set password');
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
        <Text c="dimmed">Loading employee...</Text>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Group>
          <BackButton fallbackPath="/employees" label="Back" />
          <Title order={2}>{isEditing ? 'Edit Employee' : 'Add Employee'}</Title>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {/* Basic Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconUser size={20} />
                <Title order={4}>Basic Information</Title>
              </Group>

              {/* Access code is auto-generated on the backend and managed from the
                  employee's access page — it is a private credential, not shown here.
                  Status is managed from the employee detail page, not this form. */}
              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="Enter first name"
                  required
                  {...form.getInputProps('firstName')}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Enter last name"
                  required
                  {...form.getInputProps('lastName')}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Username"
                  placeholder="Enter username for login"
                  {...form.getInputProps('username')}
                />
                <DateInput
                  label="Start Date"
                  placeholder="Select start date"
                  clearable
                  value={form.values.startDate}
                  onChange={(date) => form.setFieldValue('startDate', date)}
                />
              </Group>
            </Stack>
          </Paper>

          {/* Job Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconBriefcase size={20} />
                <Title order={4}>Job Information</Title>
              </Group>

              <Group grow>
                <TextInput
                  label="Title"
                  placeholder="e.g., Sales Representative"
                  {...form.getInputProps('title')}
                />
                <TextInput
                  label="Department"
                  placeholder="e.g., Sales"
                  {...form.getInputProps('department')}
                />
              </Group>

              <Group grow>
                <Select
                  label="Role"
                  description="Determines the employee's permissions"
                  placeholder="No role (no access)"
                  data={roles.map((r) => ({ value: String(r.id), label: r.isSuperAdmin ? `${r.name} (Full access)` : r.name }))}
                  clearable
                  {...form.getInputProps('roleId')}
                />
                <NumberInput
                  label="Commission Rate (%)"
                  placeholder="e.g., 5"
                  min={0}
                  max={100}
                  decimalScale={2}
                  {...form.getInputProps('commission')}
                />
              </Group>
            </Stack>
          </Paper>

          {/* Contact Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconPhone size={20} />
                <Title order={4}>Contact Information</Title>
              </Group>

              <TextInput
                label="Phone"
                placeholder="Enter phone number"
                {...form.getInputProps('phone')}
              />

              <Textarea
                label="Address"
                placeholder="Enter address"
                rows={3}
                {...form.getInputProps('address')}
              />

              <TextInput
                label="Emergency Contact"
                placeholder="Name and phone number"
                {...form.getInputProps('emergencyContact')}
              />
            </Stack>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              {...bind('/employees')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={submitting}
            >
              {isEditing ? 'Save Changes' : 'Create Employee'}
            </Button>
          </Group>
        </Stack>
      </form>

      {/* Prompt for a login password right after the employee is created */}
      <Modal
        opened={newEmployeeId !== null}
        onClose={() => {
          setNewEmployeeId(null);
          go('/employees');
        }}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        title={
          <Group gap="xs">
            <IconShield size={18} />
            <Text fw={600}>Set a Login Password</Text>
          </Group>
        }
        centered
      >
        <form onSubmit={passwordForm.onSubmit(handleSetPassword)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Set a login password for <strong>{newEmployeeName}</strong>. They will use this with their username to sign in.
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
              <Button
                variant="subtle"
                onClick={() => {
                  setNewEmployeeId(null);
                  go('/employees');
                }}
              >
                Skip for Now
              </Button>
              <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={settingPassword}>
                Set Password
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
