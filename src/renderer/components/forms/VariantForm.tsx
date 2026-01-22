import { useEffect } from 'react';
import {
  Stack,
  Group,
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Switch,
  Button,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';

interface VariantFormValues {
  variantSku: string;
  variantName: string;
  description: string;
  quantity: number;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  wholesalePrice: string;
  isActive: boolean;
}

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
}

interface VariantFormProps {
  parentSku: string;
  variant?: Variant | null;
  onSubmit: (values: VariantFormValues) => void;
  onCancel: () => void;
  loading?: boolean;
}

const CURRENCIES = [
  { value: 'JA', label: 'JMD' },
  { value: 'US', label: 'USD' },
];

export function VariantForm({
  parentSku,
  variant,
  onSubmit,
  onCancel,
  loading = false,
}: VariantFormProps) {
  const isEditing = !!variant;

  const form = useForm<VariantFormValues>({
    initialValues: {
      variantSku: '',
      variantName: '',
      description: '',
      quantity: 0,
      cost: '0',
      costCurrency: 'JA',
      price: '0',
      priceCurrency: 'JA',
      wholesalePrice: '',
      isActive: true,
    },
    validate: {
      variantSku: (value) => {
        if (!value) return 'Variant SKU is required';
        if (value.length < 2) return 'SKU must be at least 2 characters';
        return null;
      },
      variantName: (value) => (!value ? 'Variant name is required' : null),
      quantity: (value) => (value < 0 ? 'Quantity cannot be negative' : null),
    },
  });

  useEffect(() => {
    if (variant) {
      form.setValues({
        variantSku: variant.variantSku,
        variantName: variant.variantName || '',
        description: variant.description || '',
        quantity: variant.quantity,
        cost: variant.cost || '0',
        costCurrency: variant.costCurrency,
        price: variant.price || '0',
        priceCurrency: variant.priceCurrency,
        wholesalePrice: variant.wholesalePrice || '',
        isActive: variant.isActive,
      });
    } else {
      // Auto-generate variant SKU based on parent SKU
      form.setFieldValue('variantSku', `${parentSku}-`);
    }
  }, [variant, parentSku]);

  const handleSubmit = (values: VariantFormValues) => {
    onSubmit(values);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label="Variant SKU"
            placeholder={`${parentSku}-001`}
            required
            disabled={isEditing}
            {...form.getInputProps('variantSku')}
          />
          <TextInput
            label="Variant Name"
            placeholder="e.g., Small, Red, 500ml"
            required
            {...form.getInputProps('variantName')}
          />
        </SimpleGrid>

        <NumberInput
          label="Initial Quantity"
          min={0}
          {...form.getInputProps('quantity')}
        />

        <Textarea
          label="Description"
          placeholder="Optional description"
          rows={2}
          {...form.getInputProps('description')}
        />

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <NumberInput
            label="Cost"
            min={0}
            decimalScale={2}
            prefix="$"
            {...form.getInputProps('cost')}
          />
          <NumberInput
            label="Price"
            min={0}
            decimalScale={2}
            prefix="$"
            {...form.getInputProps('price')}
          />
          <NumberInput
            label="Wholesale Price"
            min={0}
            decimalScale={2}
            prefix="$"
            placeholder="Optional"
            {...form.getInputProps('wholesalePrice')}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Cost Currency"
            data={CURRENCIES}
            {...form.getInputProps('costCurrency')}
          />
          <Select
            label="Price Currency"
            data={CURRENCIES}
            {...form.getInputProps('priceCurrency')}
          />
        </SimpleGrid>

        <Switch
          label="Active"
          description="Inactive variants won't appear in sales"
          {...form.getInputProps('isActive', { type: 'checkbox' })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEditing ? 'Update Variant' : 'Create Variant'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
