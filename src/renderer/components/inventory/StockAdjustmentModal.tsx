import { Modal, Stack, Group, Button, NumberInput, Textarea, Text, Select } from '@mantine/core';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { PINInput } from '../auth/PINInput';
import { useAuth } from '../../contexts/AuthContext';
import type { PartVariant } from '../../../main/database/schema';
import numeral from 'numeral';

interface StockAdjustmentModalProps {
  opened: boolean;
  onClose: () => void;
  variant: PartVariant | null;
  onAdjust: (variantId: number, adjustment: number, reason: string, type: string) => Promise<void>;
}

const ADJUSTMENT_TYPES = [
  { value: 'RESTOCK', label: 'Restock (Add Inventory)' },
  { value: 'SALE', label: 'Sale' },
  { value: 'DAMAGE', label: 'Damage/Loss' },
  { value: 'RETURN', label: 'Customer Return' },
  { value: 'CORRECTION', label: 'Inventory Correction' },
  { value: 'OTHER', label: 'Other' },
];

export function StockAdjustmentModal({
  opened,
  onClose,
  variant,
  onAdjust,
}: StockAdjustmentModalProps) {
  const { verifyPIN } = useAuth();
  const [step, setStep] = useState<'details' | 'pin'>('details');
  const [adjustmentType, setAdjustmentType] = useState<string>('CORRECTION');
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStep('details');
    setAdjustmentType('CORRECTION');
    setQuantity(0);
    setReason('');
    setPin('');
    onClose();
  };

  const handleContinue = () => {
    if (!quantity) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please enter an adjustment quantity',
        color: 'red',
      });
      return;
    }

    if (!adjustmentType) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select an adjustment type',
        color: 'red',
      });
      return;
    }

    setStep('pin');
  };

  const handleSubmit = async () => {
    if (!variant) return;

    try {
      setLoading(true);

      // Verify PIN
      const isValid = await verifyPIN(pin);
      if (!isValid) {
        notifications.show({
          title: 'Invalid PIN',
          message: 'The PIN you entered is incorrect',
          color: 'red',
        });
        setPin('');
        return;
      }

      // Perform adjustment
      await onAdjust(variant.id, quantity, reason, adjustmentType);

      notifications.show({
        title: 'Success',
        message: 'Stock adjusted successfully',
        color: 'green',
      });

      handleClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to adjust stock',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const newStockLevel = variant ? variant.stockQty + quantity : 0;

  return (
    <Modal opened={opened} onClose={handleClose} title="Adjust Stock" size="md">
      {step === 'details' ? (
        <Stack>
          {variant && (
            <>
              <Text size="sm" c="dimmed">
                Current Stock: <strong>{variant.stockQty}</strong>
              </Text>
              <Text size="sm" c="dimmed">
                Variant: <strong>{variant.variantName}</strong>
              </Text>
            </>
          )}

          <Select
            label="Adjustment Type"
            data={ADJUSTMENT_TYPES}
            value={adjustmentType}
            onChange={(value) => setAdjustmentType(value || 'CORRECTION')}
            required
          />

          <NumberInput
            label="Adjustment Quantity"
            description="Use positive numbers to add stock, negative to remove"
            placeholder="0"
            value={quantity}
            onChange={(value) => setQuantity(Number(value) || 0)}
            required
          />

          {variant && (
            <Text
              size="sm"
              fw={500}
              c={newStockLevel < 0 ? 'red' : newStockLevel <= variant.reorderLevel ? 'orange' : 'green'}
            >
              New Stock Level: {newStockLevel}
              {newStockLevel < 0 && ' (Invalid - cannot be negative)'}
              {newStockLevel >= 0 && newStockLevel <= variant.reorderLevel && ' (Below reorder level)'}
            </Text>
          )}

          <Textarea
            label="Reason"
            placeholder="Explain why this adjustment is being made"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleContinue} disabled={newStockLevel < 0}>
              Continue
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Text size="sm" c="dimmed" mb="md">
            Please enter your PIN to confirm this stock adjustment
          </Text>

          <PINInput value={pin} onChange={setPin} length={4} />

          <Group justify="space-between" mt="md">
            <Button variant="subtle" onClick={() => setStep('details')} disabled={loading}>
              Back
            </Button>
            <Button onClick={handleSubmit} loading={loading} disabled={pin.length !== 4}>
              Confirm Adjustment
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
