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
  isTaxable: boolean;
}

interface InventoryEditModalProps {
  opened: boolean;
  onClose: () => void;
  item: Inventory;
  onSave: () => void;
}

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
      isTaxable: true,
    },
    validate: {
      description1: (value) => (!value ? "Description is required" : null),
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
        isTaxable: item.isTaxable ?? true,
      });
      setError(null);
    }
  }, [opened, item]);

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

                <Checkbox
                  label="Taxable"
                  description="Apply GCT to this item"
                  {...form.getInputProps("isTaxable", { type: "checkbox" })}
                />
              </Stack>
            </Paper>

            <Alert
              icon={<IconCurrencyDollar size={16} />}
              color="blue"
              variant="light"
            >
              Pricing (cost, selling price, wholesale, margin) is managed per
              variant. Use the Variants tab to edit prices.
            </Alert>
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
