import { TextInput, NumberInput, Stack, Group, Button } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { clientSchema, ClientFormData } from '../../utils/schemas';
import { CurrencyInput } from '../common/CurrencyInput';
import type { Client } from '../../../main/database/schema';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ClientForm({ client, onSubmit, onCancel, loading = false }: ClientFormProps) {

  const form = useForm<ClientFormData>({
    validate: zodResolver(clientSchema),
    initialValues: {
      name: client?.name || '',
      phone: client?.phone || '',
      email: client?.email || '',
      address1: client?.address1 || '',
      address2: client?.address2 || '',
      creditLimit: parseFloat(client?.creditLimit ?? '0'),
      discountRate: parseFloat(client?.discountRate ?? '0'),
    },
  });

  const handleSubmit = async (values: ClientFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: `Client ${client ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save client',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
     <Stack>
        <TextInput
          label="Name"
          placeholder="Client name"
          required
          {...form.getInputProps('name')}
        />

        <Group grow>
          <TextInput
            label="Phone"
            placeholder="Phone number"
            {...form.getInputProps('phone')}
          />
          <TextInput
            label="Email"
            placeholder="email@example.com"
            type="email"
            {...form.getInputProps('email')}
          />
        </Group>

        <TextInput
          label="Address Line 1"
          placeholder="Street address"
          {...form.getInputProps('address1')}
        />

        <TextInput
          label="Address Line 2"
          placeholder="Apt, Suite, etc."
          {...form.getInputProps('address2')}
        />

        <Group grow>
          <CurrencyInput
            label="Credit Limit"
            placeholder="0.00"
            {...form.getInputProps('creditLimit')}
          />
          <NumberInput
            label="Discount Rate (%)"
            placeholder="0"
            min={0}
            max={100}
            decimalScale={2}
            hideControls
            {...form.getInputProps('discountRate')}
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={client && !form.isDirty()}>
            {client ? 'Update' : 'Create'} Client
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
