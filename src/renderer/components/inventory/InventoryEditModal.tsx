import { useState, useEffect } from "react";
import {
  Modal,
  Stack,
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
  Title,
  ScrollArea,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconPackage,
  IconCurrencyDollar,
  IconMapPin,
} from "@tabler/icons-react";
import { IpcChannel } from "../../../shared/types/ipc";
import { normalizeToArray, arrayToJsonString } from "../../../shared/utils/arrayFields";
import { CategoryTagsInput, ModelTagsInput } from "../inputs";

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  minLevel: number;
  isTaxable: boolean;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  margin: string | null;
  unit: string;
  category: string | null;
  model: string | null;
  wholesalePrice: string | null;
}

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

interface InventoryEditModalProps {
  opened: boolean;
  onClose: () => void;
  item: Inventory;
  onSave: () => void;
}

const CURRENCY_OPTIONS = [
  { value: "JA", label: "JMD (JA)" },
  { value: "US", label: "USD (US)" },
];

const UNIT_OPTIONS = [
  { value: "EA", label: "Each (EA)" },
  { value: "BOX", label: "Box" },
  { value: "SET", label: "Set" },
  { value: "PR", label: "Pair (PR)" },
  { value: "LT", label: "Liter (LT)" },
  { value: "GAL", label: "Gallon (GAL)" },
  { value: "KG", label: "Kilogram (KG)" },
  { value: "LB", label: "Pound (LB)" },
  { value: "M", label: "Meter (M)" },
  { value: "FT", label: "Feet (FT)" },
];

export function InventoryEditModal({
  opened,
  onClose,
  item,
  onSave,
}: InventoryEditModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<InventoryFormValues>({
    initialValues: {
      sku: "",
      description1: "",
      description2: "",
      categories: [],
      models: [],
      location: "",
      unit: "EA",
      quantity: 0,
      minLevel: 0,
      cost: 0,
      costCurrency: "JA",
      price: 0,
      priceCurrency: "JA",
      wholesalePrice: null,
      margin: null,
      isTaxable: true,
    },
    validate: {
      description1: (value) => (!value ? "Description is required" : null),
      price: (value) => (value < 0 ? "Price cannot be negative" : null),
      cost: (value) => (value < 0 ? "Cost cannot be negative" : null),
    },
  });

  // Set form values when item changes or modal opens
  useEffect(() => {
    if (opened && item) {
      form.setValues({
        sku: item.sku || "",
        description1: item.description1 || "",
        description2: item.description2 || "",
        categories: normalizeToArray(item.category),
        models: normalizeToArray(item.model),
        location: item.location || "",
        unit: item.unit || "EA",
        quantity: item.quantity || 0,
        minLevel: item.minLevel || 0,
        cost: parseFloat(item.cost) || 0,
        costCurrency: item.costCurrency || "JA",
        price: parseFloat(item.price) || 0,
        priceCurrency: item.priceCurrency || "JA",
        wholesalePrice: item.wholesalePrice
          ? parseFloat(item.wholesalePrice)
          : null,
        margin: item.margin ? parseFloat(item.margin) : null,
        isTaxable: item.isTaxable ?? true,
      });
      setError(null);
    }
  }, [opened, item]);

  // Calculate margin when cost or price changes
  useEffect(() => {
    const cost = form.values.cost;
    const price = form.values.price;
    if (cost > 0 && price > 0) {
      const margin = ((price - cost) / cost) * 100;
      form.setFieldValue("margin", parseFloat(margin.toFixed(2)));
    } else {
      form.setFieldValue("margin", null);
    }
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
        minLevel: values.minLevel,
        cost: values.cost.toString(),
        costCurrency: values.costCurrency,
        price: values.price.toString(),
        priceCurrency: values.priceCurrency,
        wholesalePrice: values.wholesalePrice?.toString() || null,
        margin: values.margin?.toString() || null,
        isTaxable: values.isTaxable,
      };

      const result = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY, {
        id: item.id,
        data,
      });

      if (result.success) {
        notifications.show({
          title: "Item Updated",
          message: `${values.sku} has been updated successfully`,
          color: "green",
          icon: <IconCheck size={16} />,
        });

        onSave();
        onClose();
      } else {
        setError(result.error || "Failed to save inventory item");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconPackage size={20} />
          <Text fw={600}>Edit Inventory: {item.sku}</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <ScrollArea.Autosize mah="70vh">
          <Stack gap="lg" pr="xs">
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            {/* Basic Information */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconPackage size={18} />
                  <Title order={5}>Basic Information</Title>
                </Group>

                <TextInput
                  label="Part Number"
                  value={form.values.sku}
                  disabled
                  description="Part Number cannot be changed"
                />

                <CategoryTagsInput {...form.getInputProps("categories")} />

                <TextInput
                  label="Description"
                  placeholder="Primary description"
                  required
                  {...form.getInputProps("description1")}
                />

                <Textarea
                  label="Additional Description"
                  placeholder="Secondary description or notes"
                  rows={2}
                  {...form.getInputProps("description2")}
                />

                <ModelTagsInput {...form.getInputProps("models")} />

                <Select
                  label="Unit of Measure"
                  data={UNIT_OPTIONS}
                  {...form.getInputProps("unit")}
                />
              </Stack>
            </Paper>

            {/* Location & Stock */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconMapPin size={18} />
                  <Title order={5}>Location & Stock</Title>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 3 }}>
                  <TextInput
                    label="Location"
                    placeholder="Warehouse location"
                    description="Base variant location"
                    {...form.getInputProps("location")}
                  />
                  <NumberInput
                    label="Current Quantity"
                    placeholder="0"
                    min={0}
                    disabled
                    description="Use Adjust Stock to change quantity"
                    value={form.values.quantity}
                  />
                  <NumberInput
                    label="Minimum Level"
                    placeholder="0"
                    min={0}
                    description="Low stock alert threshold"
                    {...form.getInputProps("minLevel")}
                  />
                </SimpleGrid>
              </Stack>
            </Paper>

            {/* Pricing */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCurrencyDollar size={18} />
                  <Title order={5}>Pricing</Title>
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
                      {...form.getInputProps("cost")}
                    />
                    <Select
                      label="Currency"
                      data={CURRENCY_OPTIONS}
                      {...form.getInputProps("costCurrency")}
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
                      {...form.getInputProps("price")}
                    />
                    <Select
                      label="Currency"
                      data={CURRENCY_OPTIONS}
                      {...form.getInputProps("priceCurrency")}
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
                    {...form.getInputProps("wholesalePrice")}
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
                      {...form.getInputProps("isTaxable", { type: "checkbox" })}
                    />
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>
          </Stack>
        </ScrollArea.Autosize>
        {/* Actions */}
        <Group justify="flex-end" pt={10}>
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={submitting}
          >
            Save Changes
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
