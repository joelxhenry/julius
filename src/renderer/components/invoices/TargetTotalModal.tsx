import { Modal, Stack, Text, NumberInput, Group, Button, Alert, Divider } from '@mantine/core';
import { useState, useEffect, useMemo } from 'react';
import { IconAlertCircle, IconCalculator } from '@tabler/icons-react';

interface TargetTotalModalProps {
  opened: boolean;
  onClose: () => void;
  onApply: (discountPercent: number) => void;
  currentSubTotal: number;
  taxRate: number;
  isTaxable: boolean;
  formatCurrency: (value: number) => string;
}

export function TargetTotalModal({
  opened,
  onClose,
  onApply,
  currentSubTotal,
  taxRate,
  isTaxable,
  formatCurrency,
}: TargetTotalModalProps) {
  const [targetTotal, setTargetTotal] = useState<number>(0);

  // Calculate current total
  const currentTotal = useMemo(() => {
    return isTaxable ? currentSubTotal * (1 + taxRate) : currentSubTotal;
  }, [currentSubTotal, taxRate, isTaxable]);

  // Reset when modal opens
  useEffect(() => {
    if (opened) {
      setTargetTotal(currentTotal);
    }
  }, [opened, currentTotal]);

  // Calculate required discount percentage
  const calculatedDiscount = useMemo(() => {
    if (targetTotal <= 0 || currentSubTotal <= 0) return null;

    // Formula: targetTotal = subTotal * (1 - discount/100) * (1 + taxRate)
    // Solving for discount: discount = (1 - (targetTotal / (subTotal * (1 + taxRate)))) * 100
    const multiplier = isTaxable ? 1 + taxRate : 1;
    const requiredDiscount = (1 - targetTotal / (currentSubTotal * multiplier)) * 100;

    // Validate discount is reasonable
    if (requiredDiscount < 0) {
      return { percent: null, error: 'Target total is higher than current total' };
    }
    if (requiredDiscount > 100) {
      return { percent: null, error: 'Target total is too low to achieve' };
    }

    return { percent: requiredDiscount, error: null };
  }, [targetTotal, currentSubTotal, taxRate, isTaxable]);

  // Calculate projected totals after discount
  const projectedTotals = useMemo(() => {
    if (!calculatedDiscount?.percent) return null;

    const discountedSubTotal = currentSubTotal * (1 - calculatedDiscount.percent / 100);
    const tax = isTaxable ? discountedSubTotal * taxRate : 0;
    const total = discountedSubTotal + tax;

    return {
      subTotal: discountedSubTotal,
      tax,
      total,
    };
  }, [calculatedDiscount, currentSubTotal, taxRate, isTaxable]);

  const handleApply = () => {
    if (calculatedDiscount?.percent !== null && calculatedDiscount?.percent !== undefined) {
      onApply(calculatedDiscount.percent);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (calculatedDiscount?.percent !== null && calculatedDiscount?.percent !== undefined) {
        handleApply();
      }
    }
  };

  const canApply = calculatedDiscount?.percent !== null && !calculatedDiscount?.error;

  return (
    <Modal opened={opened} onClose={onClose} title="Calculate Discount for Target Total" size="md" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Enter your desired total amount. The calculator will determine the uniform discount percentage needed to reach
          that target.
        </Text>

        {/* Current Invoice Breakdown */}
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            Current Invoice
          </Text>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Subtotal:
            </Text>
            <Text size="sm">{formatCurrency(currentSubTotal)}</Text>
          </Group>
          {isTaxable && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Tax ({(taxRate * 100).toFixed(1)}%):
              </Text>
              <Text size="sm">{formatCurrency(currentSubTotal * taxRate)}</Text>
            </Group>
          )}
          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Total:
            </Text>
            <Text size="sm" fw={600}>
              {formatCurrency(currentTotal)}
            </Text>
          </Group>
        </Stack>

        <Divider />

        {/* Target Total Input */}
        <NumberInput
          label="Target Total"
          placeholder="Enter desired total amount"
          value={targetTotal}
          onChange={(value) => setTargetTotal(value as number)}
          min={0}
          decimalScale={2}
          fixedDecimalScale
          prefix="$"
          leftSection={<IconCalculator size={16} />}
          autoFocus
          onKeyDown={handleKeyDown}
        />

        {/* Calculation Result */}
        {calculatedDiscount && (
          <>
            {calculatedDiscount.error ? (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {calculatedDiscount.error}
              </Alert>
            ) : (
              <Stack gap="xs">
                <Alert icon={<IconCalculator size={16} />} color="blue" variant="light">
                  <Text size="sm" fw={600}>
                    Required Discount: {calculatedDiscount.percent.toFixed(2)}%
                  </Text>
                </Alert>

                {projectedTotals && (
                  <>
                    <Text size="sm" fw={600}>
                      Projected Invoice
                    </Text>
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Subtotal (after discount):
                      </Text>
                      <Text size="sm">{formatCurrency(projectedTotals.subTotal)}</Text>
                    </Group>
                    {isTaxable && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Tax ({(taxRate * 100).toFixed(1)}%):
                        </Text>
                        <Text size="sm">{formatCurrency(projectedTotals.tax)}</Text>
                      </Group>
                    )}
                    <Group justify="space-between">
                      <Text size="sm" fw={600} c="blue">
                        Total:
                      </Text>
                      <Text size="sm" fw={600} c="blue">
                        {formatCurrency(projectedTotals.total)}
                      </Text>
                    </Group>
                  </>
                )}
              </Stack>
            )}
          </>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!canApply}>
            Apply Discount
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
