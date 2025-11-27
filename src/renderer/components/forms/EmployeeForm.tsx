import { Stack, Group, Button, TextInput, Select } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { employeeSchema, type EmployeeFormData } from '../../utils/schemas';
import type { Employee } from '../../../main/database/schema';

interface EmployeeFormProps {
  employee?: Employee | null;
  onSubmit: (data: EmployeeFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const ROLES = [
  { value: '1', label: 'Admin' },
  { value: '2', label: 'Manager' },
  { value: '3', label: 'Cashier' },
  { value: '4', label: 'User' },
];

export function EmployeeForm({ employee, onSubmit, onCancel, loading = false }: EmployeeFormProps) {
  const form = useForm<EmployeeFormData>({
    validate: zodResolver(employeeSchema),
    initialValues: {
      firstName: employee?.firstName || '',
      lastName: employee?.lastName || '',
      username: employee?.username || '',
      title: employee?.title || '',
      roleId: employee?.roleId || undefined,
      startDate: employee?.startDate || new Date().toISOString().split('T')[0],
      endDate: employee?.endDate || '',
    },
  });

  const handleSubmit = async (values: EmployeeFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: `Employee ${employee ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
      form.reset();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save employee',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <Group grow>
          <TextInput
            label="First Name"
            placeholder="John"
            required
            {...form.getInputProps('firstName')}
          />

          <TextInput
            label="Last Name"
            placeholder="Doe"
            required
            {...form.getInputProps('lastName')}
          />
        </Group>

        <TextInput
          label="Username"
          placeholder="jdoe"
          required
          {...form.getInputProps('username')}
        />

        <TextInput label="Job Title" placeholder="Manager" {...form.getInputProps('title')} />

        <Select
          label="Role"
          placeholder="Select role"
          data={ROLES}
          {...form.getInputProps('roleId')}
          onChange={(value) => form.setFieldValue('roleId', value ? parseInt(value) : undefined)}
        />

        <Group grow>
          <DateInput
            label="Start Date"
            placeholder="Select date"
            required
            valueFormat="YYYY-MM-DD"
            value={form.values.startDate ? new Date(form.values.startDate) : null}
            onChange={(date) =>
              form.setFieldValue('startDate', date?.toISOString().split('T')[0] || '')
            }
          />

          <DateInput
            label="End Date"
            placeholder="Leave blank if active"
            clearable
            valueFormat="YYYY-MM-DD"
            value={form.values.endDate ? new Date(form.values.endDate) : null}
            onChange={(date) =>
              form.setFieldValue('endDate', date?.toISOString().split('T')[0] || '')
            }
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {employee ? 'Update' : 'Create'} Employee
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
