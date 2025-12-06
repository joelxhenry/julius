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
  Alert,
  Checkbox,
  Badge,
  Divider,
  Loader,
} from '@mantine/core';
import { IconCash, IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

export interface PaymentEntry {
  type: 'payment' | 'credit_note';
  paymentMethodCode?: string;
  creditNoteId?: number;
  amount: string;
  notes?: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface CreditNote {
  id: number;
  crNumber: string;
  total: string;
  totalUsed: string;
  crDate: string;
}

interface PaymentEntryModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (entries: PaymentEntry[]) => void;
  invoiceTotal: number;
  clientId: number | null;
}

export function PaymentEntryModal({
  opened,
  onClose,
  onSubmit,
  invoiceTotal,
  clientId,
}: PaymentEntryModalProps) {
  const { user } = useAuth();
  const [paymentEntries, setPaymentEntries] = useState<PaymentEntry[]>([
    { type: 'payment', paymentMethodCode: 'CASH', amount: invoiceTotal.toFixed(2) },
  ]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [availableCreditNotes, setAvailableCreditNotes] = useState<CreditNote[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [isLoadingCreditNotes, setIsLoadingCreditNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

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

  // Load available credit notes for client
  useEffect(() => {
    const loadCreditNotes = async () => {
      if (!clientId) return;

      setIsLoadingCreditNotes(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_PAGINATED, {
          page: 1,
          pageSize: 100,
          clientId,
          status: 'A', // Only active credit notes
        });
        if (result.success && result.data) {
          setAvailableCreditNotes(result.data.data);
        }
      } catch (err) {
        console.error('Failed to load credit notes:', err);
      } finally {
        setIsLoadingCreditNotes(false);
      }
    };

    if (opened && clientId) {
      loadCreditNotes();
    }
  }, [opened, clientId]);

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
      setPaymentEntries([{ type: 'payment', paymentMethodCode: 'CASH', amount: invoiceTotal.toFixed(2) }]);
      setError(null);
    }
  }, [opened, invoiceTotal]);

  const handleAddPaymentEntry = useCallback(() => {
    const remainingBalance = invoiceTotal - totalPayment;
    setPaymentEntries((prev) => [
      ...prev,
      { type: 'payment', paymentMethodCode: 'CASH', amount: Math.max(0, remainingBalance).toFixed(2) },
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
      setError(`Total payment ($${total.toFixed(2)}) exceeds invoice total ($${invoiceTotal.toFixed(2)})`);
      return;
    }

    // Validate each entry
    for (const entry of paymentEntries) {
      if (!entry.amount || parseFloat(entry.amount) <= 0) {
        setError('All payment amounts must be greater than 0');
        return;
      }

      if (entry.type === 'payment' && !entry.paymentMethodCode) {
        setError('Please select a payment method for all entries');
        return;
      }

      if (entry.type === 'credit_note' && !entry.creditNoteId) {
        setError('Please select a credit note');
        return;
      }
    }

    onSubmit(paymentEntries);
  }, [paymentEntries, invoiceTotal, onSubmit]);

  const paymentMethodOptions = paymentMethods.map((pm) => ({
    value: pm.code,
    label: pm.name,
  }));

  const creditNoteOptions = availableCreditNotes.map((cn) => {
    const available = parseFloat(cn.total) - parseFloat(cn.totalUsed);
    return {
      value: cn.id.toString(),
      label: `${cn.crNumber} - Available: $${available.toFixed(2)}`,
    };
  });

  const balanceRemaining = invoiceTotal - totalPayment;
  const isPaid = totalPayment >= invoiceTotal - 0.01;
  const isPartiallyPaid = totalPayment > 0 && totalPayment < invoiceTotal - 0.01;

  return (
    <Modal opened={opened} onClose={onClose} title="Record Payment" size="lg" closeOnClickOutside={false}>
      <Stack gap="md">
        {/* Invoice total and balance info */}
        <Group justify="space-between">
          <div>
            <Text size="sm" c="dimmed">
              Invoice Total
            </Text>
            <Text size="lg" fw={700}>
              ${invoiceTotal.toFixed(2)}
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Total Payment
            </Text>
            <Text size="lg" fw={700} c={isPaid ? 'green' : isPartiallyPaid ? 'orange' : undefined}>
              ${totalPayment.toFixed(2)}
            </Text>
          </div>
          <div>
            <Text size="sm" c="dimmed">
              Balance Remaining
            </Text>
            <Text size="lg" fw={700} c={balanceRemaining > 0.01 ? 'orange' : 'green'}>
              ${balanceRemaining.toFixed(2)}
            </Text>
          </div>
        </Group>

        {isPaid && (
          <Badge color="green" size="lg" variant="light">
            Invoice will be fully paid
          </Badge>
        )}
        {isPartiallyPaid && (
          <Badge color="orange" size="lg" variant="light">
            Partial payment - invoice will remain active
          </Badge>
        )}

        <Divider />

        {/* Payment entries */}
        <Stack gap="sm">
          <Text fw={500}>Payment Entries</Text>

          {paymentEntries.map((entry, index) => (
            <Group key={index} align="flex-start" gap="sm">
              <Select
                label="Type"
                value={entry.type}
                onChange={(value) => handleUpdateEntry(index, 'type', value)}
                data={[
                  { value: 'payment', label: 'Payment' },
                  ...(clientId ? [{ value: 'credit_note', label: 'Credit Note' }] : []),
                ]}
                style={{ width: 150 }}
              />

              {entry.type === 'payment' && (
                <Select
                  label="Payment Method"
                  value={entry.paymentMethodCode || null}
                  onChange={(value) => handleUpdateEntry(index, 'paymentMethodCode', value)}
                  data={paymentMethodOptions}
                  disabled={isLoadingMethods}
                  style={{ flex: 1 }}
                />
              )}

              {entry.type === 'credit_note' && (
                <Select
                  label="Credit Note"
                  value={entry.creditNoteId?.toString() || null}
                  onChange={(value) => handleUpdateEntry(index, 'creditNoteId', value ? parseInt(value) : undefined)}
                  data={creditNoteOptions}
                  disabled={isLoadingCreditNotes}
                  style={{ flex: 1 }}
                  searchable
                />
              )}

              <NumberInput
                label="Amount"
                value={entry.amount}
                onChange={(value) => handleUpdateEntry(index, 'amount', typeof value === 'number' ? value.toFixed(2) : value)}
                min={0}
                decimalScale={2}
                fixedDecimalScale
                prefix="$"
                ref={index === 0 ? amountInputRef : undefined}
                style={{ width: 150 }}
              />

              {paymentEntries.length > 1 && (
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  onClick={() => handleRemovePaymentEntry(index)}
                  style={{ marginTop: 24 }}
                >
                  <IconTrash size={16} />
                </Button>
              )}
            </Group>
          ))}

          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleAddPaymentEntry} fullWidth>
            Add Another Payment Method
          </Button>
        </Stack>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="Validation Error">
            {error}
          </Alert>
        )}

        <Group justify="flex-end" gap="sm" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button leftSection={<IconCash size={16} />} onClick={handleSubmit} color="green">
            Create Invoice & Record Payment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
