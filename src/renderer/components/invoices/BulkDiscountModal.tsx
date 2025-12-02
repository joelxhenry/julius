import { Modal, Stack, Text, NumberInput, Group, Button } from '@mantine/core';
import { useState, useEffect } from 'react';

interface BulkDiscountModalProps {
  opened: boolean;
  onClose: () => void;
  onApply: (discountPercent: number) => void;
}

export function BulkDiscountModal({ opened, onClose, onApply }: BulkDiscountModalProps) {
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Reset when modal opens
  useEffect(() => {
    if (opened) {
      setDiscountPercent(0);
    }
  }, [opened]);

  const handleApply = () => {
    onApply(discountPercent);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Apply Bulk Discount"
      size="sm"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Apply a uniform discount percentage to all line items. This will replace any existing discounts.
        </Text>

        <NumberInput
          label="Discount Percentage"
          placeholder="Enter discount %"
          value={discountPercent}
          onChange={(value) => setDiscountPercent(value as number)}
          min={0}
          max={100}
          decimalScale={2}
          suffix="%"
          autoFocus
          onKeyDown={handleKeyDown}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply Discount</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
