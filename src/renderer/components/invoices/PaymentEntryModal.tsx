import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  Alert,
  Divider,
  Loader,
  ActionIcon,
} from '@mantine/core';
import { IconCash, IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

export interface PaymentEntry {
  paymentMethodCode: string;
  amount: string;
  transactionReference?: string;
  notes?: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface PaymentEntryModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (entries: PaymentEntry[]) => void;
  invoiceTotal: number;
  clientId: number | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function PaymentEntryModal({
  opened,
  onClose,
  onSubmit,
  invoiceTotal,
  clientId,
}: PaymentEntryModalProps) {
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([
    { paymentMethodCode: 'CASH', amount: invoiceTotal.toFixed(2) },
  ]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Calculate total payment from all entries
  const totalPayment = paymentEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);

  // Load payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          setPaymentMethods(result.data);
        }
      } catch (err) {
        console.error('Failed to load payment methods:', err);
      } finally {
        setIsLoadingMethods(false);
      }
    };

    if (opened) {
      loadPaymentMethods();
    }
  }, [opened]);

  // Auto-focus amount input when modal opens
  useEffect(() => {
    if (opened && amountInputRef.current) {
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 100);
    }
  }, [opened]);

  // Reset form when modal closes
  useEffect(() => {
    if (!opened) {
      setPaymentEntries([{ paymentMethodCode: 'CASH', amount: invoiceTotal.toFixed(2) }]);
      setError(null);
    }
  }, [opened, invoiceTotal]);

  const handleAddPaymentEntry = useCallback(() => {
    const remainingBalance = invoiceTotal - totalPayment;
    setPaymentEntries((prev) => [
      ...prev,
      { paymentMethodCode: 'CASH', amount: Math.max(0, remainingBalance).toFixed(2) },
    ]);
  }, [invoiceTotal, totalPayment]);

  const handleRemovePaymentEntry = useCallback((index: number) => {
    setPaymentEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateEntry = useCallback((index: number, field: keyof PaymentEntry, value: any) => {
    setPaymentEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        return { ...entry, [field]: value };
      })
    );

    // Auto-focus amount field after selecting payment method
    if (field === 'paymentMethodCode' && value) {
      setTimeout(() => {
        amountInputRefs.current[index]?.focus();
        amountInputRefs.current[index]?.select();
      }, 100);
    }
  }, []);

  const handleSubmit = useCallback(() => {
    setError(null);

    // Validation
    if (paymentEntries.length === 0) {
      setError('At least one payment entry is required');
      return;
    }

    const total = paymentEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);

    if (total <= 0) {
      setError('Total payment must be greater than 0');
      return;
    }

    if (total > invoiceTotal + 0.01) {
      setError(`Total payment (${formatCurrency(total)}) exceeds invoice total (${formatCurrency(invoiceTotal)})`);
      return;
    }

    // Validate each entry
    for (const entry of paymentEntries) {
      if (!entry.amount || parseFloat(entry.amount) <= 0) {
        setError('All payment amounts must be greater than 0');
        return;
      }

      if (!entry.paymentMethodCode) {
        setError('Please select a payment method for all entries');
        return;
      }
    }

    onSubmit(paymentEntries);
  }, [paymentEntries, invoiceTotal, onSubmit]);

  const paymentMethodOptions = paymentMethods.map((pm) => ({
    value: pm.code,
    label: pm.name,
  }));

  const balanceRemaining = invoiceTotal - totalPayment;
  const isPaid = totalPayment >= invoiceTotal - 0.01;
  const isPartiallyPaid = totalPayment > 0 && totalPayment < invoiceTotal - 0.01;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCash size={20} />
          <Text fw={600}>Record Payment</Text>
        </Group>
      }
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        {/* Summary — matches RecordPaymentModal's info block */}
        <Stack
          gap={4}
          p="sm"
          style={{
            backgroundColor: 'var(--mantine-color-gray-light)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Invoice Total</Text>
            <Text size="sm" fw={500}>{formatCurrency(invoiceTotal)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Total Payment</Text>
            <Text size="sm" c={isPaid ? 'green' : isPartiallyPaid ? 'orange' : undefined}>
              {formatCurrency(totalPayment)}
            </Text>
          </Group>
          <Divider my={4} />
          <Group justify="space-between">
            <Text size="sm" fw={500}>Balance Remaining</Text>
            <Text size="sm" fw={600} c={balanceRemaining > 0.01 ? 'red' : 'green'}>
              {formatCurrency(balanceRemaining)}
            </Text>
          </Group>
        </Stack>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Divider label="Payment" labelPosition="center" />

        {/* Payment entries */}
        <Stack gap="md">
          {paymentEntries.map((entry, index) => (
            <Stack key={index} gap="sm">
              {index > 0 && <Divider variant="dashed" />}

              <Group align="flex-end" gap="sm">
                <NumberInput
                  label="Payment Amount"
                  placeholder="0.00"
                  value={entry.amount}
                  onChange={(value) =>
                    handleUpdateEntry(index, 'amount', typeof value === 'number' ? value.toFixed(2) : value)
                  }
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  prefix="$"
                  thousandSeparator=","
                  ref={(el) => {
                    amountInputRefs.current[index] = el;
                    if (index === 0 && amountInputRef) {
                      (amountInputRef as any).current = el;
                    }
                  }}
                  style={{ flex: 1 }}
                  required
                />

                <Select
                  label="Payment Method"
                  placeholder="Select payment method"
                  value={entry.paymentMethodCode || null}
                  onChange={(value) => handleUpdateEntry(index, 'paymentMethodCode', value)}
                  data={paymentMethodOptions}
                  disabled={isLoadingMethods}
                  rightSection={isLoadingMethods ? <Loader size={14} /> : undefined}
                  style={{ flex: 1 }}
                  required
                />

                {paymentEntries.length > 1 && (
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="lg"
                    onClick={() => handleRemovePaymentEntry(index)}
                    aria-label="Remove payment method"
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>

              <TextInput
                label="Reference #"
                placeholder="e.g., Trace #, Auth code"
                value={entry.transactionReference || ''}
                onChange={(event) => handleUpdateEntry(index, 'transactionReference', event.currentTarget.value)}
              />

              <Textarea
                label="Notes (optional)"
                placeholder="Payment notes..."
                value={entry.notes || ''}
                onChange={(event) => handleUpdateEntry(index, 'notes', event.currentTarget.value)}
                minRows={2}
              />
            </Stack>
          ))}

          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleAddPaymentEntry} fullWidth>
            Add Another Payment Method
          </Button>
        </Stack>

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconCash size={16} />} onClick={handleSubmit}>
            Create Invoice & Record Payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
