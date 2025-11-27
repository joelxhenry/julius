import { Stack, Group, Button, TextInput, Select, Textarea, Switch } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { userSchema, type UserFormData } from '../../utils/schemas';
import type { User } from '../../../main/database/schema';

interface UserFormProps {
  user?: User | null;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const ROLES = [
  { value: '1', label: 'Admin' },
  { value: '2', label: 'Manager' },
  { value: '3', label: 'Cashier' },
  { value: '4', label: 'User' },
];

export function UserForm({ user, onSubmit, onCancel, loading = false }: UserFormProps) {
  const form = useForm<UserFormData>({
    validate: zodResolver(userSchema),
    initialValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      username: user?.username || '',
      title: user?.title || '',
      department: user?.department || '',
      roleId: user?.roleId || undefined,
      phone: user?.phone || '',
      address: user?.address || '',
      code: user?.code || '',
      startDate: user?.startDate || '',
      endDate: user?.endDate || '',
      active: user?.active ?? true,
    },
  });

  const handleSubmit = async (values: UserFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: `User ${user ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
      form.reset();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save user',
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

        <Group grow>
          <TextInput
            label="Username"
            placeholder="jdoe"
            required
            {...form.getInputProps('username')}
          />

          <TextInput
            label="Email"
            placeholder="john@example.com"
            {...form.getInputProps('email')}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Job Title"
            placeholder="Manager"
            {...form.getInputProps('title')}
          />

          <TextInput
            label="Department"
            placeholder="Sales"
            {...form.getInputProps('department')}
          />
        </Group>

        <Group grow>
          <Select
            label="Role"
            placeholder="Select role"
            data={ROLES}
            value={form.values.roleId?.toString()}
            onChange={(value) => form.setFieldValue('roleId', value ? parseInt(value) : undefined)}
          />

          <TextInput
            label="Employee Code"
            placeholder="EMP001"
            {...form.getInputProps('code')}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Phone"
            placeholder="+1 234 567 8900"
            {...form.getInputProps('phone')}
          />

          <DateInput
            label="Start Date"
            placeholder="Select date"
            clearable
            valueFormat="YYYY-MM-DD"
            value={form.values.startDate ? new Date(form.values.startDate) : null}
            onChange={(date) =>
              form.setFieldValue('startDate', date?.toISOString().split('T')[0] || '')
            }
          />
        </Group>

        <Textarea
          label="Address"
          placeholder="Enter address"
          {...form.getInputProps('address')}
        />

        <Switch
          label="Active"
          checked={form.values.active}
          onChange={(event) => form.setFieldValue('active', event.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {user ? 'Update' : 'Create'} User
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
