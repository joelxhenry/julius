import { TextInput, Textarea, Stack, Group, Button, Checkbox } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { partSchema, PartFormData } from '../../utils/schemas';
import { CurrencyInput } from '../common/CurrencyInput';
import type { Part } from '../../../main/database/schema';

interface PartFormProps {
  part?: Part;
  onSubmit: (data: PartFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PartForm({ part, onSubmit, onCancel, loading = false }: PartFormProps) {
  const form = useForm<PartFormData>({
    validate: zodResolver(partSchema),
    initialValues: {
      name: part?.name || '',
      category: part?.category || '',
      description: part?.description || '',
      sku: part?.sku || '',
      price: part?.price || 0,
      taxable: part?.taxable ?? true,
    },
  });

  const handleSubmit = async (values: PartFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: `Part ${part ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save part',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput
          label="Part Name"
          placeholder="Enter part name"
          required
          {...form.getInputProps('name')}
        />

        <Group grow>
          <TextInput
            label="SKU"
            placeholder="Part SKU/Code"
            required
            {...form.getInputProps('sku')}
          />
          <TextInput
            label="Category"
            placeholder="e.g., Brakes, Suspension"
            {...form.getInputProps('category')}
          />
        </Group>

        <Textarea
          label="Description"
          placeholder="Part description"
          minRows={3}
          {...form.getInputProps('description')}
        />

        <Group grow>
          <CurrencyInput
            label="Base Price"
            placeholder="0.00"
            required
            {...form.getInputProps('price')}
          />
          <Checkbox
            label="Taxable"
            mt="lg"
            {...form.getInputProps('taxable', { type: 'checkbox' })}
          />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {part ? 'Update' : 'Create'} Part
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
