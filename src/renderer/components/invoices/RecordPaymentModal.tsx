import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Group, Loader, NumberInput, Select, Textarea, Alert } from '@mantine/core';
import { IconCash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';

interface Invoice {
  id: number;
  invNumber: string;
  clientName: string | null;
  total: string;
  totalPaid: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

interface RecordPaymentModalProps {
  opened: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
  invoice: Invoice | null;
}

export function RecordPaymentModal({
  opened,
  onClose,
  onPaymentRecorded,
  invoice,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState<number | string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Calculate balance due
  const balanceDue = invoice
    ? parseFloat(invoice.total) - parseFloat(invoice.totalPaid)
    : 0;

  // Load payment methods
  useEffect(() => {
    const loadPaymentMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          setPaymentMethods(result.data);
          // Set default payment method if available
          if (result.data.length > 0 && !paymentMethodId) {
            setPaymentMethodId(result.data[0].id.toString());
          }
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

  // Reset form when modal opens
  useEffect(() => {
    if (opened && invoice) {
      setAmount(balanceDue > 0 ? balanceDue : '');
      setNotes('');
      setError(null);
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 100);
    }
  }, [opened, invoice, balanceDue]);

  const handleSubmit = useCallback(async () => {
    if (!invoice) return;

    const paymentAmount = typeof amount === 'number' ? amount : parseFloat(amount as string);

    if (!paymentAmount || paymentAmount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    if (paymentAmount > balanceDue) {
      setError(`Payment amount cannot exceed balance due ($${balanceDue.toFixed(2)})`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Record the payment
      const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_PAYMENT, {
        invoiceNumber: invoice.invNumber,
        amount: paymentAmount.toFixed(2),
        payerName: invoice.clientName || 'Walk-in Customer',
        paymentDesc: notes || undefined,
      });

      if (result.success) {
        notifications.show({
          title: 'Payment Recorded',
          message: `Payment of $${paymentAmount.toFixed(2)} recorded for invoice ${invoice.invNumber}`,
          color: 'green',
        });
        onPaymentRecorded();
        onClose();
      } else {
        setError(result.error || 'Failed to record payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsLoading(false);
    }
  }, [invoice, amount, balanceDue, notes, onPaymentRecorded, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, isLoading, onClose]
  );

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (!invoice) return null;

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
      size="md"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        {/* Invoice Info */}
        <Stack gap={4} p="sm" bg="var(--mantine-color-gray-light)">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Invoice</Text>
            <Text size="sm" fw={500}>{invoice.invNumber}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Client</Text>
            <Text size="sm">{invoice.clientName || 'Walk-in Customer'}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Total</Text>
            <Text size="sm">{formatCurrency(parseFloat(invoice.total))}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Paid</Text>
            <Text size="sm" c="green">{formatCurrency(parseFloat(invoice.totalPaid))}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" fw={500}>Balance Due</Text>
            <Text size="sm" fw={500} c={balanceDue > 0 ? 'red' : 'green'}>
              {formatCurrency(balanceDue)}
            </Text>
          </Group>
        </Stack>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <NumberInput
          ref={amountInputRef}
          label="Payment Amount"
          placeholder="0.00"
          value={amount}
          onChange={setAmount}
          onKeyDown={handleKeyDown}
          min={0.01}
          max={balanceDue}
          decimalScale={2}
          fixedDecimalScale
          prefix="$"
          thousandSeparator=","
          disabled={isLoading}
          required
        />

        <Select
          label="Payment Method"
          placeholder="Select payment method"
          value={paymentMethodId}
          onChange={setPaymentMethodId}
          data={paymentMethods.map((pm) => ({
            value: pm.id.toString(),
            label: pm.name,
          }))}
          disabled={isLoading || isLoadingMethods}
          rightSection={isLoadingMethods ? <Loader size={14} /> : undefined}
        />

        <Textarea
          label="Notes (optional)"
          placeholder="Payment notes..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          disabled={isLoading}
        />

        <Group justify="space-between" mt="md">
          <Button
            variant="subtle"
            onClick={() => setAmount(balanceDue)}
            disabled={isLoading}
          >
            Pay Full Balance
          </Button>
          <Group gap="sm">
            <Button variant="subtle" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading || !amount}>
              {isLoading ? <Loader size="xs" color="white" /> : 'Record Payment'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
