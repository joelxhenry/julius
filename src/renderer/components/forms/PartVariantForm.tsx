import { Stack, Group, Button, TextInput, NumberInput, Checkbox, Textarea, Select } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { partVariantSchema, type PartVariantFormData } from '../../utils/schemas';
import { CurrencyInput } from '../common/CurrencyInput';
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
      sku: variant?.sku || '',
      name: variant?.name || '',
      description: variant?.description || '',
      isGeneric: variant?.isGeneric || false,
      cost: variant?.cost ? parseFloat(variant.cost) : undefined,
      price: variant?.price ? parseFloat(variant.price) : undefined,
      wholesalePrice: variant?.wholesalePrice ? parseFloat(variant.wholesalePrice) : undefined,
      currency: variant?.currency || 'JMD',
      margin: variant?.margin ? parseFloat(variant.margin) : undefined,
      reorderLevel: variant?.reorderLevel || 0,
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
        <Group grow>
          <TextInput
            label="SKU"
            placeholder="Variant SKU"
            {...form.getInputProps('sku')}
          />
          <TextInput
            label="Variant Name"
            placeholder="e.g., LEFT, RIGHT, Standard, Premium"
            {...form.getInputProps('name')}
          />
        </Group>

        <Textarea
          label="Description"
          placeholder="Additional details about this variant"
          {...form.getInputProps('description')}
        />

        <Group grow>
          <CurrencyInput
            label="Cost"
            placeholder="0.00"
            {...form.getInputProps('cost')}
          />
          <CurrencyInput
            label="Price"
            placeholder="0.00"
            {...form.getInputProps('price')}
          />
        </Group>

        <Group grow>
          <CurrencyInput
            label="Wholesale Price"
            placeholder="0.00"
            {...form.getInputProps('wholesalePrice')}
          />
          <NumberInput
            label="Margin (%)"
            placeholder="0"
            min={0}
            max={100}
            decimalScale={2}
            hideControls
            {...form.getInputProps('margin')}
          />
        </Group>

        <Group grow>
          <Select
            label="Currency"
            data={[
              { value: 'JMD', label: 'JMD - Jamaican Dollar' },
              { value: 'USD', label: 'USD - US Dollar' },
            ]}
            {...form.getInputProps('currency')}
          />
          <NumberInput
            label="Reorder Level"
            placeholder="0"
            min={0}
            hideControls
            {...form.getInputProps('reorderLevel')}
          />
        </Group>

        <Group grow>
          <TextInput
            label="Barcode"
            placeholder="Scan or enter barcode"
            {...form.getInputProps('barcode')}
          />
          <TextInput
            label="Storage Location"
            placeholder="e.g., A1-B3, Shelf 5"
            {...form.getInputProps('location')}
          />
        </Group>

        <Checkbox
          label="Generic Part (Aftermarket)"
          {...form.getInputProps('isGeneric', { type: 'checkbox' })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={variant && !form.isDirty()}>
            {variant ? 'Update' : 'Create'} Variant
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
