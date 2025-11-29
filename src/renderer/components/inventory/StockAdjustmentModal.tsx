import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  NumberInput,
  Textarea,
  Select,
  Text,
  Badge,
  Paper,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconMinus, IconRefresh } from '@tabler/icons-react';
import { z } from 'zod';
import { usePartVariants, type PartVariantWithPart } from '../../hooks';
import { AsyncSelect, type AsyncSelectOption } from '../common/AsyncSelect';
import type { PartVariant } from '../../../main/database/schema';

const stockAdjustmentSchema = z.object({
  variantId: z.number().min(1, 'Part variant is required'),
  adjustmentType: z.enum(['add', 'remove', 'set']),
  quantity: z.number().min(0, 'Quantity must be positive'),
  reason: z.string().optional(),
});

type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;

interface StockAdjustmentModalProps {
  opened: boolean;
  onClose: () => void;
  variant?: PartVariant | null;
}

export function StockAdjustmentModal({ opened, onClose, variant: initialVariant }: StockAdjustmentModalProps) {
  const { updateStock, searchForSelect } = usePartVariants();
  const [selectedVariant, setSelectedVariant] = useState<PartVariant | null>(initialVariant || null);
  const [loading, setLoading] = useState(false);
  const [initialOptions, setInitialOptions] = useState<AsyncSelectOption[]>([]);

  const form = useForm<StockAdjustmentFormData>({
    validate: zodResolver(stockAdjustmentSchema),
    initialValues: {
      variantId: initialVariant?.id || 0,
      adjustmentType: 'add',
      quantity: 0,
      reason: '',
    },
  });

  // Cache for variants fetched during search
  const [variantCache, setVariantCache] = useState<Map<string, PartVariantWithPart>>(new Map());

  // Reset form when modal opens with a new variant
  useEffect(() => {
    if (opened) {
      if (initialVariant) {
        setSelectedVariant(initialVariant);
        setInitialOptions([{
          value: `${initialVariant.id}`,
          label: `${initialVariant.sku || 'No SKU'} - ${initialVariant.name || 'Unnamed'} (Stock: ${initialVariant.stockQty})`,
        }]);
        form.setValues({
          variantId: initialVariant.id,
          adjustmentType: 'add',
          quantity: 0,
          reason: '',
        });
      } else {
        setSelectedVariant(null);
        setInitialOptions([]);
        setVariantCache(new Map());
        form.reset();
      }
    }
  }, [opened, initialVariant]);

  // Search function for AsyncSelect
  const handleSearch = useCallback(async (query: string): Promise<AsyncSelectOption[]> => {
    const results = await searchForSelect(query, 20);
    // Cache the variants for later lookup
    const newCache = new Map(variantCache);
    results.forEach((v) => {
      newCache.set(`${v.id}`, v);
    });
    setVariantCache(newCache);

    return results.map((v) => ({
      value: `${v.id}`,
      label: `${v.sku || 'No SKU'} - ${v.name || 'Unnamed'} (Stock: ${v.stockQty})`,
    }));
  }, [searchForSelect, variantCache]);

  const handleVariantChange = useCallback((value: string | null) => {
    if (value) {
      const cachedVariant = variantCache.get(value);
      if (cachedVariant) {
        setSelectedVariant(cachedVariant);
        form.setFieldValue('variantId', cachedVariant.id);
      }
    } else {
      setSelectedVariant(null);
      form.setFieldValue('variantId', 0);
    }
  }, [variantCache, form]);

  const calculateNewStock = () => {
    if (!selectedVariant) return 0;
    const currentStock = selectedVariant.stockQty;
    const { adjustmentType, quantity } = form.values;

    switch (adjustmentType) {
      case 'add':
        return currentStock + quantity;
      case 'remove':
        return Math.max(0, currentStock - quantity);
      case 'set':
        return quantity;
      default:
        return currentStock;
    }
  };

  const handleSubmit = async (values: StockAdjustmentFormData) => {
    if (!selectedVariant) return;

    setLoading(true);
    try {
      const newStock = calculateNewStock();

      await updateStock(selectedVariant.id, newStock);

      const adjustmentText = values.adjustmentType === 'add'
        ? `Added ${values.quantity}`
        : values.adjustmentType === 'remove'
        ? `Removed ${values.quantity}`
        : `Set to ${values.quantity}`;

      notifications.show({
        title: 'Stock Updated',
        message: `${selectedVariant.name || selectedVariant.sku}: ${adjustmentText}. New stock: ${newStock}`,
        color: 'green',
      });

      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to update stock',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const newStock = calculateNewStock();
  const stockDiff = selectedVariant ? newStock - selectedVariant.stockQty : 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Adjust Stock"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          {!initialVariant && (
            <AsyncSelect
              label="Search Part Variant"
              placeholder="Search by SKU or name..."
              value={selectedVariant ? `${selectedVariant.id}` : null}
              onChange={handleVariantChange}
              onSearch={handleSearch}
              initialOptions={initialOptions}
              clearable
            />
          )}

          {selectedVariant && (
            <Paper withBorder p="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{selectedVariant.name || 'Unnamed Variant'}</Text>
                  <Text size="sm" c="dimmed">SKU: {selectedVariant.sku || 'N/A'}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text size="sm" c="dimmed">Current Stock</Text>
                  <Badge size="lg" color={selectedVariant.stockQty === 0 ? 'red' : 'blue'}>
                    {selectedVariant.stockQty}
                  </Badge>
                </div>
              </Group>
            </Paper>
          )}

          <Select
            label="Adjustment Type"
            data={[
              { value: 'add', label: 'Add Stock (+)' },
              { value: 'remove', label: 'Remove Stock (-)' },
              { value: 'set', label: 'Set Stock (=)' },
            ]}
            leftSection={
              form.values.adjustmentType === 'add' ? <IconPlus size={16} /> :
              form.values.adjustmentType === 'remove' ? <IconMinus size={16} /> :
              <IconRefresh size={16} />
            }
            {...form.getInputProps('adjustmentType')}
          />

          <NumberInput
            label="Quantity"
            placeholder="Enter quantity"
            min={0}
            required
            {...form.getInputProps('quantity')}
          />

          {selectedVariant && form.values.quantity > 0 && (
            <Paper withBorder p="sm">
              <Group justify="space-between">
                <Text size="sm">New Stock Level:</Text>
                <Group gap="xs">
                  <Badge
                    size="lg"
                    color={newStock === 0 ? 'red' : newStock <= (selectedVariant.reorderLevel || 0) ? 'yellow' : 'green'}
                  >
                    {newStock}
                  </Badge>
                  {stockDiff !== 0 && (
                    <Text size="sm" c={stockDiff > 0 ? 'green' : 'red'}>
                      ({stockDiff > 0 ? '+' : ''}{stockDiff})
                    </Text>
                  )}
                </Group>
              </Group>
            </Paper>
          )}

          <Textarea
            label="Reason (Optional)"
            placeholder="e.g., Received shipment, Damaged goods, Inventory count..."
            {...form.getInputProps('reason')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={!selectedVariant || form.values.quantity === 0}
              leftSection={
                form.values.adjustmentType === 'add' ? <IconPlus size={16} /> :
                form.values.adjustmentType === 'remove' ? <IconMinus size={16} /> :
                <IconRefresh size={16} />
              }
            >
              {form.values.adjustmentType === 'add' ? 'Add' :
               form.values.adjustmentType === 'remove' ? 'Remove' : 'Set'} Stock
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
