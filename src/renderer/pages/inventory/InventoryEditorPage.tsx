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
  Text,
  Alert,
  SimpleGrid,
  Table,
  ActionIcon,
  Modal,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconPackage,
  IconCurrencyDollar,
  IconMapPin,
  IconPlus,
  IconTrash,
  IconEdit,
  IconTags,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { VariantForm } from '../../components/forms';

interface Category {
  id: number;
  category: string;
}

interface PendingVariant {
  tempId: string;
  variantSku: string;
  variantName: string;
  variantType: string;
  description: string;
  quantity: number;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  wholesalePrice: string;
  isActive: boolean;
}

interface InventoryFormValues {
  sku: string;
  description1: string;
  description2: string;
  category: string;
  model: string;
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

export function InventoryEditorPage() {
  const navigate = useNavigate();
  const { replaceCurrentTab } = useTabContext();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);

  // Variant state for new items
  const [pendingVariants, setPendingVariants] = useState<PendingVariant[]>([]);
  const [editingVariant, setEditingVariant] = useState<PendingVariant | null>(null);
  const [variantModalOpened, { open: openVariantModal, close: closeVariantModal }] = useDisclosure(false);

  const form = useForm<InventoryFormValues>({
    initialValues: {
      sku: '',
      description1: '',
      description2: '',
      category: '',
      model: '',
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
    },
    validate: {
      sku: (value) => (!value ? 'SKU is required' : null),
      description1: (value) => (!value ? 'Description is required' : null),
      price: (value) => (value < 0 ? 'Price cannot be negative' : null),
      cost: (value) => (value < 0 ? 'Cost cannot be negative' : null),
    },
  });

  useEffect(() => {
    loadCategories();
  }, []);

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
  }, [form.values.cost, form.values.price]);

  const loadCategories = async () => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CATEGORIES, { categoryType: 'inventory' });
      if (result.success && result.data) {
        const categoryOptions = result.data.map((cat: Category) => ({
          value: cat.category,
          label: cat.category,
        }));
        setCategories(categoryOptions);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  // Variant handlers
  const handleAddVariant = () => {
    setEditingVariant(null);
    openVariantModal();
  };

  const handleEditVariant = (variant: PendingVariant) => {
    setEditingVariant(variant);
    openVariantModal();
  };

  const handleDeleteVariant = (tempId: string) => {
    setPendingVariants((prev) => prev.filter((v) => v.tempId !== tempId));
  };

  const handleVariantSubmit = (values: {
    variantSku: string;
    variantName: string;
    variantType: string;
    description: string;
    quantity: number;
    cost: string;
    costCurrency: string;
    price: string;
    priceCurrency: string;
    wholesalePrice: string;
    isActive: boolean;
  }) => {
    if (editingVariant) {
      // Update existing variant
      setPendingVariants((prev) =>
        prev.map((v) =>
          v.tempId === editingVariant.tempId ? { ...values, tempId: v.tempId } : v
        )
      );
    } else {
      // Add new variant
      const newVariant: PendingVariant = {
        ...values,
        tempId: `temp-${Date.now()}`,
      };
      setPendingVariants((prev) => [...prev, newVariant]);
    }
    closeVariantModal();
    setEditingVariant(null);
  };

  const handleSubmit = async (values: InventoryFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        sku: values.sku,
        description1: values.description1 || null,
        description2: values.description2 || null,
        category: values.category || null,
        model: values.model || null,
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
        // If there are pending variants, create them
        if (pendingVariants.length > 0) {
          const createdSku = result.data?.sku || values.sku;
          let variantsCreated = 0;
          let variantsFailed = 0;

          for (const variant of pendingVariants) {
            try {
              const variantResult = await window.electron.invoke(IpcChannel.CREATE_VARIANT, {
                parentSku: createdSku,
                variantSku: variant.variantSku,
                variantName: variant.variantName || null,
                variantType: variant.variantType || null,
                description: variant.description || null,
                quantity: variant.quantity,
                cost: variant.cost || null,
                costCurrency: variant.costCurrency,
                price: variant.price || null,
                priceCurrency: variant.priceCurrency,
                wholesalePrice: variant.wholesalePrice || null,
                isActive: variant.isActive,
              });
              if (variantResult.success) {
                variantsCreated++;
              } else {
                variantsFailed++;
              }
            } catch (err) {
              variantsFailed++;
              console.error('Failed to create variant:', err);
            }
          }

          if (variantsFailed > 0) {
            notifications.show({
              title: 'Item Created with Warnings',
              message: `${values.sku} created. ${variantsCreated} variants created, ${variantsFailed} failed.`,
              color: 'yellow',
              icon: <IconAlertCircle size={16} />,
            });
          } else {
            notifications.show({
              title: 'Item Created',
              message: `${values.sku} has been created with ${variantsCreated} variant(s)`,
              color: 'green',
              icon: <IconCheck size={16} />,
            });
          }
        } else {
          notifications.show({
            title: 'Item Created',
            message: `${values.sku} has been created successfully`,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }

        // Navigate to detail page for the created item
        const itemId = result.data?.id;
        replaceCurrentTab(itemId ? `/inventory/${itemId}` : '/inventory');
      } else {
        setError(result.error || 'Failed to create inventory item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Group>
          <Title order={2}>Add Inventory Item</Title>
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
                <IconPackage size={20} />
                <Title order={4}>Basic Information</Title>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="SKU"
                  placeholder="Enter SKU code"
                  required
                  {...form.getInputProps('sku')}
                />
                <Select
                  label="Category"
                  placeholder="Select category"
                  data={categories}
                  searchable
                  clearable
                  {...form.getInputProps('category')}
                />
              </SimpleGrid>

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

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="Model"
                  placeholder="Model number or name"
                  {...form.getInputProps('model')}
                />
                <Select
                  label="Unit of Measure"
                  data={UNIT_OPTIONS}
                  {...form.getInputProps('unit')}
                />
              </SimpleGrid>
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

          {/* Variants */}
          <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <IconTags size={20} />
                    <Title order={4}>Variants</Title>
                    {pendingVariants.length > 0 && (
                      <Badge size="sm" variant="light">
                        {pendingVariants.length}
                      </Badge>
                    )}
                  </Group>
                  <Button
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={handleAddVariant}
                    disabled={!form.values.sku}
                  >
                    Add Variant
                  </Button>
                </Group>

                {!form.values.sku && (
                  <Text size="sm" c="dimmed">
                    Enter a SKU first to add variants
                  </Text>
                )}

                {pendingVariants.length > 0 ? (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Qty</Table.Th>
                        <Table.Th>Price</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th w={80}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pendingVariants.map((variant) => (
                        <Table.Tr key={variant.tempId}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {variant.variantSku}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{variant.variantName || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" tt="capitalize">
                              {variant.variantType || '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{variant.quantity}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {variant.price ? `$${variant.price}` : '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              size="sm"
                              color={variant.isActive ? 'green' : 'gray'}
                              variant="light"
                            >
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                onClick={() => handleEditVariant(variant)}
                              >
                                <IconEdit size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                variant="subtle"
                                color="red"
                                onClick={() => handleDeleteVariant(variant.tempId)}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  form.values.sku && (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No variants added yet. Click "Add Variant" to create one.
                    </Text>
                  )
                )}
              </Stack>
            </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => navigate('/inventory')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={submitting}
            >
              Create Item
            </Button>
          </Group>
        </Stack>
      </form>

      {/* Variant Modal */}
      <Modal
        opened={variantModalOpened}
        onClose={() => {
          closeVariantModal();
          setEditingVariant(null);
        }}
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
        size="lg"
      >
        <VariantForm
          parentSku={form.values.sku}
          variant={
            editingVariant
              ? {
                id: 0,
                parentSku: form.values.sku,
                variantSku: editingVariant.variantSku,
                variantName: editingVariant.variantName,
                variantType: editingVariant.variantType,
                attributes: {},
                description: editingVariant.description,
                quantity: editingVariant.quantity,
                cost: editingVariant.cost,
                costCurrency: editingVariant.costCurrency,
                price: editingVariant.price,
                priceCurrency: editingVariant.priceCurrency,
                wholesalePrice: editingVariant.wholesalePrice,
                isActive: editingVariant.isActive,
              }
              : null
          }
          onSubmit={handleVariantSubmit}
          onCancel={() => {
            closeVariantModal();
            setEditingVariant(null);
          }}
        />
      </Modal>
    </Stack>
  );
}
