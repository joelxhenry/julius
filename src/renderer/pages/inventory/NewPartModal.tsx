import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Paper,
  Group,
  Title,
  TextInput,
  Textarea,
  Button,
  Select,
  Checkbox,
  NumberInput,
  Alert,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconPackage,
  IconCurrencyDollar,
  IconMapPin,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { CategoryTagsInput, ModelTagsInput } from '../../components/inputs';
import { arrayToJsonString } from '../../../shared/utils/arrayFields';

interface InventoryFormValues {
  sku: string;
  description1: string;
  description2: string;
  categories: string[];
  models: string[];
  location: string;
  unit: string;
  quantity: number;
  minLevel: number;
  cost: number;
  costCurrency: string;
  price: number;
  priceCurrency: string;
  wholesalePrice: number | null;
  margin: number | null;
  isTaxable: boolean;
}

const CURRENCY_OPTIONS = [
  { value: 'JA', label: 'JMD (JA)' },
  { value: 'US', label: 'USD (US)' },
];

const UNIT_OPTIONS = [
  { value: 'EA', label: 'Each (EA)' },
  { value: 'BOX', label: 'Box' },
  { value: 'SET', label: 'Set' },
  { value: 'PR', label: 'Pair (PR)' },
  { value: 'LT', label: 'Liter (LT)' },
  { value: 'GAL', label: 'Gallon (GAL)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'LB', label: 'Pound (LB)' },
  { value: 'M', label: 'Meter (M)' },
  { value: 'FT', label: 'Feet (FT)' },
];

const INITIAL_VALUES: InventoryFormValues = {
  sku: '',
  description1: '',
  description2: '',
  categories: [],
  models: [],
  location: '',
  unit: 'EA',
  quantity: 0,
  minLevel: 0,
  cost: 0,
  costCurrency: 'JA',
  price: 0,
  priceCurrency: 'JA',
  wholesalePrice: null,
  margin: null,
  isTaxable: true,
};

interface NewPartModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called after a part is successfully created (e.g. to refresh the list). */
  onCreated?: (item: { id?: number; sku: string }) => void;
}

export function NewPartModal({ opened, onClose, onCreated }: NewPartModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<InventoryFormValues>({
    initialValues: INITIAL_VALUES,
    validate: {
      sku: (value) => (!value ? 'Part Number is required' : null),
      description1: (value) => (!value ? 'Description is required' : null),
      price: (value) => (value < 0 ? 'Price cannot be negative' : null),
      cost: (value) => (value < 0 ? 'Cost cannot be negative' : null),
    },
  });

  // Reset the form each time the modal is opened.
  useEffect(() => {
    if (opened) {
      form.setValues(INITIAL_VALUES);
      form.resetDirty(INITIAL_VALUES);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  // Calculate margin when cost or price changes
  useEffect(() => {
    const cost = form.values.cost;
    const price = form.values.price;
    if (cost > 0 && price > 0) {
      const margin = ((price - cost) / cost) * 100;
      form.setFieldValue('margin', parseFloat(margin.toFixed(2)));
    } else {
      form.setFieldValue('margin', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.cost, form.values.price]);

  const handleSubmit = async (values: InventoryFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        sku: values.sku,
        description1: values.description1 || null,
        description2: values.description2 || null,
        category: arrayToJsonString(values.categories),
        model: arrayToJsonString(values.models),
        location: values.location || null,
        unit: values.unit,
        quantity: values.quantity,
        minLevel: values.minLevel,
        cost: values.cost.toString(),
        costCurrency: values.costCurrency,
        price: values.price.toString(),
        priceCurrency: values.priceCurrency,
        wholesalePrice: values.wholesalePrice?.toString() || null,
        margin: values.margin?.toString() || null,
        isTaxable: values.isTaxable,
      };

      const result = await window.electron.invoke(IpcChannel.CREATE_INVENTORY, data);

      if (result.success) {
        notifications.show({
          title: 'Part Created',
          message: `${values.sku} has been created successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        onCreated?.({ id: result.data?.id, sku: result.data?.sku || values.sku });
        onClose();
      } else {
        setError(result.error || 'Failed to create part');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add Part" size="lg">
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {/* Basic Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconPackage size={20} />
                <Title order={4}>Basic Information</Title>
              </Group>

              <TextInput
                label="Part Number"
                placeholder="Enter part number"
                required
                data-autofocus
                {...form.getInputProps('sku')}
              />

              <CategoryTagsInput {...form.getInputProps('categories')} />

              <TextInput
                label="Description"
                placeholder="Primary description"
                required
                {...form.getInputProps('description1')}
              />

              <Textarea
                label="Additional Description"
                placeholder="Secondary description or notes"
                rows={2}
                {...form.getInputProps('description2')}
              />

              <ModelTagsInput {...form.getInputProps('models')} />

              <Select label="Unit of Measure" data={UNIT_OPTIONS} {...form.getInputProps('unit')} />
            </Stack>
          </Paper>

          {/* Location & Stock */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconMapPin size={20} />
                <Title order={4}>Location & Stock</Title>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 3 }}>
                <TextInput
                  label="Location"
                  placeholder="Warehouse location"
                  {...form.getInputProps('location')}
                />
                <NumberInput
                  label="Current Quantity"
                  placeholder="0"
                  min={0}
                  {...form.getInputProps('quantity')}
                />
                <NumberInput
                  label="Minimum Level"
                  placeholder="0"
                  min={0}
                  description="Low stock alert threshold"
                  {...form.getInputProps('minLevel')}
                />
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* Pricing */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconCurrencyDollar size={20} />
                <Title order={4}>Pricing</Title>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Group grow>
                  <NumberInput
                    label="Cost"
                    placeholder="0.00"
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator
                    {...form.getInputProps('cost')}
                  />
                  <Select
                    label="Currency"
                    data={CURRENCY_OPTIONS}
                    {...form.getInputProps('costCurrency')}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Selling Price"
                    placeholder="0.00"
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator
                    {...form.getInputProps('price')}
                  />
                  <Select
                    label="Currency"
                    data={CURRENCY_OPTIONS}
                    {...form.getInputProps('priceCurrency')}
                  />
                </Group>
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 3 }}>
                <NumberInput
                  label="Wholesale Price"
                  placeholder="0.00"
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  thousandSeparator
                  {...form.getInputProps('wholesalePrice')}
                />
                <NumberInput
                  label="Margin %"
                  placeholder="Auto-calculated"
                  disabled
                  decimalScale={2}
                  suffix="%"
                  value={form.values.margin ?? undefined}
                />
                <Stack gap="xs" justify="flex-end">
                  <Checkbox
                    label="Taxable"
                    description="Apply GCT to this item"
                    {...form.getInputProps('isTaxable', { type: 'checkbox' })}
                  />
                </Stack>
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={submitting}>
              Create Part
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
