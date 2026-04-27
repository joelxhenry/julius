import { useState } from 'react';
import {
  Stack,
  Group,
  TextInput,
  Button,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { InventorySelect } from '../selects';

interface AlternateFormValues {
  alternateNo: string;
  supplier: string;
}

interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
}

interface AlternateFormProps {
  partNo: string; // Current part's SKU - will be excluded from search results
  onSubmit: (values: AlternateFormValues) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function AlternateForm({
  partNo,
  onSubmit,
  onCancel,
  loading = false,
}: AlternateFormProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | undefined>();

  const form = useForm<AlternateFormValues>({
    initialValues: {
      alternateNo: '',
      supplier: '',
    },
    validate: {
      alternateNo: (value) => (!value ? 'Alternate Part Number is required' : null),
    },
  });

  const handleInventorySelect = (sku: string | null, item?: InventoryItem) => {
    if (sku) {
      form.setFieldValue('alternateNo', sku);
      setSelectedItem(item);
    } else {
      form.setFieldValue('alternateNo', '');
      setSelectedItem(undefined);
    }
  };

  const handleSubmit = (values: AlternateFormValues) => {
    onSubmit(values);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Select an existing inventory item to link as an alternate part number for <Text span fw={600}>{partNo}</Text>
        </Text>

        <InventorySelect
          value={form.values.alternateNo}
          onChange={handleInventorySelect}
          label="Alternate Item"
          placeholder="Search for inventory item..."
          required
          excludeSku={partNo}
          error={form.errors.alternateNo as string}
        />

        {selectedItem && (
          <Text size="sm" c="dimmed">
            Selected: {selectedItem.description1 || 'No description'}
          </Text>
        )}

        <TextInput
          label="Supplier"
          placeholder="Optional supplier name"
          {...form.getInputProps('supplier')}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Alternate
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
