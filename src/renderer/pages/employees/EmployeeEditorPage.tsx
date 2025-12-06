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
  Checkbox,
  NumberInput,
  Divider,
  Text,
  Loader,
  Alert,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconUser,
  IconPhone,
  IconBriefcase,
  IconRefresh,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
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
}

export function EmployeeEditorPage() {
  const navigate = useNavigate();
  const { id } = useTabParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      isSalesperson: false,
      commission: null,
      username: '',
    },
    validate: {
      code: (value) => (!value ? 'Employee code is required' : null),
      firstName: (value) => (!value ? 'First name is required' : null),
      lastName: (value) => (!value ? 'Last name is required' : null),
    },
  });

  useEffect(() => {
    if (isEditing && id) {
      loadEmployee(parseInt(id, 10));
    } else {
      // Generate a new employee code for new employees
      generateEmployeeCode();
    }
  }, [id, isEditing]);

  const generateEmployeeCode = async (isInitialLoad = true) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setGeneratingCode(true);
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
      } else {
        setGeneratingCode(false);
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
        navigate('/employees');
      } else {
        setError(result.error || 'Failed to save employee');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
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
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/employees')}
          >
            Back
          </Button>
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

              <Group grow>
                <TextInput
                  label="Employee Code"
                  placeholder="e.g., EMP001"
                  required
                  disabled
                  description={isEditing ? undefined : 'Auto-generated'}
                  rightSection={
                    !isEditing && (
                      <Tooltip label="Generate new code">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => generateEmployeeCode(false)}
                          loading={generatingCode}
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )
                  }
                  {...form.getInputProps('code')}
                />
                <Select
                  label="Status"
                  data={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                    { value: 'suspended', label: 'Suspended' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Group>

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

              <Divider />

              <Checkbox
                label="Is Salesperson"
                description="Check if this employee is a salesperson"
                {...form.getInputProps('isSalesperson', { type: 'checkbox' })}
              />

              {form.values.isSalesperson && (
                <NumberInput
                  label="Commission Rate (%)"
                  placeholder="e.g., 5"
                  min={0}
                  max={100}
                  decimalScale={2}
                  {...form.getInputProps('commission')}
                />
              )}
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
              onClick={() => navigate('/employees')}
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
    </Stack>
  );
}
