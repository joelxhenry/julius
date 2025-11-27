import { Stack, Group, Button, TextInput, NumberInput, Checkbox, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { partVariantSchema, type PartVariantFormData } from '../../utils/schemas';
import type { PartVariant } from '../../../main/database/schema';

interface PartVariantFormProps {
  partId: number;
  variant?: PartVariant | null;
  onSubmit: (data: PartVariantFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function PartVariantForm({
  partId,
  variant,
  onSubmit,
  onCancel,
  loading = false,
}: PartVariantFormProps) {
  const form = useForm<PartVariantFormData>({
    validate: zodResolver(partVariantSchema),
    initialValues: {
      partId,
      name: variant?.variantName || '',
      description: variant?.description || '',
      isGeneric: variant?.isGeneric || false,
      price: variant ? parseFloat(variant.price) : 0,
      stockQty: variant?.stockQty || 0,
      reorderLevel: variant?.reorderLevel || 0,
      active: variant?.active ?? true,
      barcode: variant?.barcode || '',
      location: variant?.location || '',
    },
  });

  const handleSubmit = async (values: PartVariantFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: `Variant ${variant ? 'updated' : 'created'} successfully`,
        color: 'green',
      });
      form.reset();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save variant',
        color: 'red',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack>
        <TextInput
          label="Variant Name"
          placeholder="e.g., LEFT, RIGHT, Standard, Premium"
          required
          {...form.getInputProps('name')}
        />

        <Textarea
          label="Description"
          placeholder="Additional details about this variant"
          {...form.getInputProps('description')}
        />

        <Group grow>
          <NumberInput
            label="Price"
            placeholder="0.00"
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
            thousandSeparator=","
            min={0}
            required
            {...form.getInputProps('price')}
          />

          <TextInput
            label="Barcode"
            placeholder="Scan or enter barcode"
            {...form.getInputProps('barcode')}
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Stock Quantity"
            placeholder="0"
            min={0}
            required
            {...form.getInputProps('stockQty')}
          />

          <NumberInput
            label="Reorder Level"
            placeholder="0"
            min={0}
            required
            {...form.getInputProps('reorderLevel')}
          />
        </Group>

        <TextInput
          label="Storage Location"
          placeholder="e.g., A1-B3, Shelf 5"
          {...form.getInputProps('location')}
        />

        <Group>
          <Checkbox
            label="Generic Part"
            {...form.getInputProps('isGeneric', { type: 'checkbox' })}
          />

          <Checkbox label="Active" {...form.getInputProps('active', { type: 'checkbox' })} />
        </Group>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {variant ? 'Update' : 'Create'} Variant
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
