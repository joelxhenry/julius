import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Textarea,
  TextInput,
  Alert,
  Divider,
} from '@mantine/core';
import { IconCash, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

interface RefundCreditNote {
  id: number;
  crNumber: string;
  clientName: string | null;
  total: string;
  totalUsed: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface CreditNoteRefundModalProps {
  opened: boolean;
  onClose: () => void;
  onRefunded: () => void;
  creditNote: RefundCreditNote | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

/**
 * Cash out (refund) a credit note's remaining balance to the customer. Records a
 * draw-down against the note via CASH_OUT_CREDIT_NOTE and marks it Used once the
 * balance reaches zero. Store Credit is not offered as a payout method - a refund
 * moves money out, it does not issue more store credit.
 */
export function CreditNoteRefundModal({ opened, onClose, onRefunded, creditNote }: CreditNoteRefundModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number | string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const remaining = creditNote
    ? parseFloat(creditNote.total || '0') - parseFloat(creditNote.totalUsed || '0')
    : 0;
  const payout = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;

  // Load payout methods (exclude Store Credit - a refund pays money out).
  useEffect(() => {
    if (!opened) return;
    const load = async () => {
      setIsLoadingMethods(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          const methods: PaymentMethod[] = result.data.filter((m: PaymentMethod) => m.code !== 'STORE_CREDIT');
          setPaymentMethods(methods);
          setPaymentMethodId((prev) => prev ?? (methods[0]?.id.toString() ?? null));
        }
      } catch (err) {
        console.error('Failed to load payment methods:', err);
      } finally {
        setIsLoadingMethods(false);
      }
    };
    load();
  }, [opened]);

  // Reset the form each time the modal opens or the target note changes.
  useEffect(() => {
    if (opened && creditNote) {
      setAmount(remaining > 0 ? remaining : '');
      setTransactionReference('');
      setNotes('');
      setError(null);
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, creditNote?.id]);

  const handleSubmit = useCallback(async () => {
    if (!creditNote || !user) {
      setError('You must be logged in to refund a credit note');
      return;
    }
    if (payout <= 0) {
      setError('Please enter a refund amount');
      return;
    }
    if (payout > remaining + 0.01) {
      setError(`Refund cannot exceed the remaining balance (${formatCurrency(remaining)})`);
      return;
    }
    const selectedMethod = paymentMethods.find((pm) => pm.id.toString() === paymentMethodId);
    if (!selectedMethod) {
      setError('Please select a payout method');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.CASH_OUT_CREDIT_NOTE, {
        creditNoteId: creditNote.id,
        processedById: user.id,
        payerName: creditNote.clientName,
        amount: payout.toFixed(2),
        method: selectedMethod.code,
        methodLabel: selectedMethod.name,
        transactionReference: transactionReference || undefined,
        notes: notes || undefined,
      });

      if (result.success) {
        notifications.show({
          title: 'Credit Note Refunded',
          message: `${formatCurrency(payout)} paid out from ${creditNote.crNumber}`,
          color: 'green',
        });
        onRefunded();
        onClose();
      } else {
        setError(result.error || 'Failed to refund credit note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refund credit note');
    } finally {
      setIsLoading(false);
    }
  }, [creditNote, user, payout, remaining, paymentMethods, paymentMethodId, transactionReference, notes, onRefunded, onClose]);

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

  if (!creditNote) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCash size={20} />
          <Text fw={600}>Cash Out / Refund Credit Note</Text>
        </Group>
      }
      centered
      size="md"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        {/* Credit note summary */}
        <Stack
          gap={4}
          p="sm"
          style={{ backgroundColor: 'var(--mantine-color-gray-light)', borderRadius: 'var(--mantine-radius-sm)' }}
        >
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Credit Note</Text>
            <Text size="sm" fw={500}>{creditNote.crNumber}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Customer</Text>
            <Text size="sm">{creditNote.clientName || 'Walk-in Customer'}</Text>
          </Group>
          <Divider my={4} />
          <Group justify="space-between">
            <Text size="sm" fw={500}>Remaining Balance</Text>
            <Text size="sm" fw={600} c={remaining > 0 ? 'green' : 'dimmed'}>{formatCurrency(remaining)}</Text>
          </Group>
        </Stack>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {remaining <= 0.001 ? (
          <Alert color="gray" variant="light">
            This credit note has no remaining balance to refund.
          </Alert>
        ) : (
          <>
            <NumberInput
              ref={amountInputRef}
              label="Refund Amount"
              placeholder="0.00"
              value={amount}
              onChange={setAmount}
              onKeyDown={handleKeyDown}
              min={0}
              max={remaining}
              decimalScale={2}
              fixedDecimalScale
              prefix="$"
              thousandSeparator=","
              disabled={isLoading}
              required
            />

            <Select
              label="Payout Method"
              placeholder="How is the money paid out?"
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              data={paymentMethods.map((pm) => ({ value: pm.id.toString(), label: pm.name }))}
              disabled={isLoading || isLoadingMethods}
              rightSection={isLoadingMethods ? <Loader size={14} /> : undefined}
              required
            />

            <TextInput
              label="Reference #"
              placeholder="e.g., Cheque #, Trace #, Auth code"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.currentTarget.value)}
              disabled={isLoading}
            />

            <Textarea
              label="Notes (optional)"
              placeholder="Refund notes..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              minRows={2}
              disabled={isLoading}
            />
          </>
        )}

        <Group justify="space-between" mt="md">
          {remaining > 0.001 && (
            <Button variant="subtle" onClick={() => setAmount(remaining)} disabled={isLoading}>
              Refund Full Balance
            </Button>
          )}
          <Group gap="sm" ml="auto">
            <Button variant="subtle" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              loading={isLoading}
              disabled={remaining <= 0.001 || payout <= 0 || !paymentMethodId}
              leftSection={<IconCash size={16} />}
            >
              Refund {payout > 0 ? formatCurrency(payout) : ''}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
