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
  Input,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';

// Values emitted to the parent form. `variantSku` is the full computed SKU
// (`{parentSku}-{suffix}`), not the raw suffix the user types.
interface VariantFormValues {
  variantSku: string;
  variantName: string;
  location: string;
  description: string;
  quantity: number;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  // Margin is derived from cost/price and edited interchangeably with price;
  // it is not persisted (variants have no margin column).
  margin: string;
  wholesalePrice: string;
  isActive: boolean;
}

// Internal form state. The product SKU (parent part number) is fixed; the user
// only edits the suffix appended after the hyphen.
interface VariantFormState extends Omit<VariantFormValues, 'variantSku'> {
  variantSuffix: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Slugify a variant name into an uppercase, hyphen-separated SKU suffix.
// e.g. "500ml Bottle" -> "500ML-BOTTLE".
const deriveSuffix = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// margin% = (price - cost) / cost * 100. Undefined when cost is 0/invalid.
const marginFromCostPrice = (costStr: string, priceStr: string): string => {
  const c = parseFloat(costStr || '0');
  const p = parseFloat(priceStr || '0');
  if (!Number.isFinite(c) || c <= 0) return '';
  return round2(((p - c) / c) * 100).toString();
};

// price = cost * (1 + margin/100).
const priceFromCostMargin = (costStr: string, marginStr: string): string => {
  const c = parseFloat(costStr || '0');
  const m = parseFloat(marginStr || '0');
  if (!Number.isFinite(c)) return '0';
  return round2(c * (1 + (Number.isFinite(m) ? m : 0) / 100)).toFixed(2);
};

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  location: string | null;
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

  const form = useForm<VariantFormState>({
    initialValues: {
      variantSuffix: '',
      variantName: '',
      location: '',
      description: '',
      quantity: 0,
      cost: '0',
      costCurrency: 'JA',
      price: '0',
      priceCurrency: 'JA',
      margin: '',
      wholesalePrice: '',
      isActive: true,
    },
    validate: {
      variantName: (value) => (!value ? 'Variant name is required' : null),
      quantity: (value) => (value < 0 ? 'Quantity cannot be negative' : null),
    },
  });

  useEffect(() => {
    if (variant) {
      // Strip the parent prefix so only the suffix is shown/edited.
      const prefix = `${variant.parentSku}-`;
      const suffix = variant.variantSku.startsWith(prefix)
        ? variant.variantSku.slice(prefix.length)
        : variant.variantSku;
      form.setValues({
        variantSuffix: suffix,
        variantName: variant.variantName || '',
        location: variant.location || '',
        description: variant.description || '',
        quantity: variant.quantity,
        cost: variant.cost || '0',
        costCurrency: variant.costCurrency,
        price: variant.price || '0',
        priceCurrency: variant.priceCurrency,
        margin: marginFromCostPrice(variant.cost || '0', variant.price || '0'),
        wholesalePrice: variant.wholesalePrice || '',
        isActive: variant.isActive,
      });
    } else {
      form.setFieldValue('variantSuffix', '');
    }
  }, [variant, parentSku]);

  const handleSubmit = (values: VariantFormState) => {
    const { variantSuffix, ...rest } = values;
    // Suffix is optional; fall back to a slug of the variant name.
    const suffix = variantSuffix.trim() || deriveSuffix(values.variantName);
    onSubmit({ ...rest, variantSku: `${parentSku}-${suffix}` });
  };

  const toStr = (val: number | string) => (val === '' || val == null ? '' : String(val));

  // Editing cost keeps the selling price and re-derives margin.
  const handleCostChange = (val: number | string) => {
    const cost = toStr(val);
    form.setFieldValue('cost', cost);
    form.setFieldValue('margin', marginFromCostPrice(cost, form.values.price));
  };

  // Editing price re-derives margin from cost.
  const handlePriceChange = (val: number | string) => {
    const price = toStr(val);
    form.setFieldValue('price', price);
    form.setFieldValue('margin', marginFromCostPrice(form.values.cost, price));
  };

  // Editing margin re-derives the selling price from cost.
  const handleMarginChange = (val: number | string) => {
    const margin = toStr(val);
    form.setFieldValue('margin', margin);
    form.setFieldValue('price', priceFromCostMargin(form.values.cost, margin));
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Input.Wrapper
            label="Variant Part ID"
            description={
              isEditing
                ? undefined
                : 'Suffix is optional - defaults to the variant name if left blank'
            }
          >
            <Group gap={0} wrap="nowrap" align="center" mt={4}>
              <Text
                fw={600}
                c="dimmed"
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {parentSku}-
              </Text>
              <Input
                style={{ flex: 1 }}
                placeholder={
                  deriveSuffix(form.values.variantName) || 'SUFFIX'
                }
                disabled={isEditing}
                {...form.getInputProps('variantSuffix')}
              />
            </Group>
          </Input.Wrapper>
          <TextInput
            label="Variant Name"
            placeholder="e.g., Small, Red, 500ml"
            required
            {...form.getInputProps('variantName')}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <NumberInput
            label="Initial Quantity"
            min={0}
            {...form.getInputProps('quantity')}
          />
          <TextInput
            label="Location"
            placeholder="Warehouse location"
            {...form.getInputProps('location')}
          />
        </SimpleGrid>

        <Textarea
          label="Description"
          placeholder="Optional description"
          rows={2}
          {...form.getInputProps('description')}
        />

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <NumberInput
            label="Cost"
            min={0}
            decimalScale={2}
            prefix="$"
            value={form.values.cost}
            onChange={handleCostChange}
          />
          <NumberInput
            label="Selling Price"
            min={0}
            decimalScale={2}
            prefix="$"
            value={form.values.price}
            onChange={handlePriceChange}
          />
          <NumberInput
            label="Margin"
            decimalScale={2}
            suffix="%"
            placeholder="-"
            value={form.values.margin}
            onChange={handleMarginChange}
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
