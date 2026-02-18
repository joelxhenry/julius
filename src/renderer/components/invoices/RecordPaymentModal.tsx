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
  Badge,
  Divider,
  Box,
  ThemeIcon,
} from '@mantine/core';
import { IconCash, IconAlertCircle, IconReceipt, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { ApplyCreditNoteModal } from './ApplyCreditNoteModal';

interface Invoice {
  id: number;
  invNumber: string;
  clientId: number | null;
  clientName: string | null;
  total: string;
  totalPaid: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface RecordPaymentModalProps {
  opened: boolean;
  onClose: () => void;
  onPaymentRecorded: () => void;
  onCreditApplied?: () => void;
  invoice: Invoice | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function RecordPaymentModal({
  opened,
  onClose,
  onPaymentRecorded,
  onCreditApplied,
  invoice,
}: RecordPaymentModalProps) {
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

  // Applied credit notes (tracked locally after each ApplyCreditNoteModal submission)
  const [appliedCredits, setAppliedCredits] = useState<Array<{ crNumber: string; amount: number }>>([]);
  const [cnModalOpen, setCnModalOpen] = useState(false);

  const balanceDue = invoice
    ? parseFloat(invoice.total) - parseFloat(invoice.totalPaid)
    : 0;

  const totalCreditApplied = appliedCredits.reduce((sum, c) => sum + c.amount, 0);
  const effectiveBalance = Math.max(0, balanceDue - totalCreditApplied);
  const cashPayment = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;

  // Load payment methods
  useEffect(() => {
    if (!opened) return;
    const loadPaymentMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          setPaymentMethods(result.data);
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
    loadPaymentMethods();
  }, [opened]);

  // Reset form when modal opens
  useEffect(() => {
    if (opened && invoice) {
      const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
      setAmount(balance > 0 ? balance : '');
      setTransactionReference('');
      setNotes('');
      setError(null);
      setAppliedCredits([]);
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 100);
    }
  }, [opened, invoice]);

  // Update cash amount when credits are applied
  const handleCreditApplied = useCallback(
    (creditAmount: number, crNumber: string) => {
      setAppliedCredits((prev) => {
        const updated = [...prev, { crNumber, amount: creditAmount }];
        const totalApplied = updated.reduce((sum, c) => sum + c.amount, 0);
        const newBalance = Math.max(0, balanceDue - totalApplied);
        setAmount(newBalance > 0 ? newBalance : 0);
        return updated;
      });
      // Notify parent page so it can refresh invoice totals/credit note balances immediately
      onCreditApplied?.();
    },
    [balanceDue, onCreditApplied]
  );

  const handleSubmit = useCallback(async () => {
    if (!invoice || !user) {
      setError('You must be logged in to record payments');
      return;
    }

    // If the entire balance was covered by credits, just acknowledge
    if (effectiveBalance <= 0.001 && cashPayment <= 0) {
      onPaymentRecorded();
      onClose();
      return;
    }

    if (cashPayment <= 0) {
      setError('Please enter a payment amount');
      return;
    }
    if (!paymentMethodId) {
      setError('Please select a payment method');
      return;
    }
    if (cashPayment > effectiveBalance + 0.01) {
      setError(`Payment cannot exceed balance due (${formatCurrency(effectiveBalance)})`);
      return;
    }

    const selectedMethod = paymentMethods.find((pm) => pm.id.toString() === paymentMethodId);
    if (!selectedMethod) {
      setError('Selected payment method is invalid');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.PROCESS_INVOICE_PAYMENT, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invNumber,
        clientId: invoice.clientId,
        processedById: user.id,
        payerName: invoice.clientName || 'Walk-in Customer',
        entries: [
          {
            type: 'payment',
            paymentMethodCode: selectedMethod.code,
            amount: cashPayment.toFixed(2),
            transactionReference: transactionReference || undefined,
            notes: notes || undefined,
          },
        ],
      });

      if (result.success) {
        notifications.show({
          title: 'Payment Recorded',
          message: `${formatCurrency(cashPayment)} recorded for invoice ${invoice.invNumber}`,
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
  }, [
    invoice,
    user,
    effectiveBalance,
    cashPayment,
    paymentMethodId,
    paymentMethods,
    transactionReference,
    notes,
    onPaymentRecorded,
    onClose,
  ]);

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

  if (!invoice) return null;

  const allCoveredByCredit = effectiveBalance <= 0.001 && totalCreditApplied > 0;

  return (
    <>
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
          {/* Invoice Info */}
          <Stack
            gap={4}
            p="sm"
            style={{
              backgroundColor: 'var(--mantine-color-gray-light)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
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
            {totalCreditApplied > 0 && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Credits Applied (this session)</Text>
                <Text size="sm" c="teal">{formatCurrency(totalCreditApplied)}</Text>
              </Group>
            )}
            <Divider my={4} />
            <Group justify="space-between">
              <Text size="sm" fw={500}>Balance Due</Text>
              <Text size="sm" fw={600} c={effectiveBalance > 0 ? 'red' : 'green'}>
                {formatCurrency(effectiveBalance)}
              </Text>
            </Group>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          {/* Applied credits list */}
          {appliedCredits.length > 0 && (
            <Box
              p="sm"
              style={{
                border: '1px solid var(--mantine-color-teal-3)',
                borderRadius: 'var(--mantine-radius-sm)',
                backgroundColor: 'var(--mantine-color-teal-light)',
              }}
            >
              <Text size="xs" fw={600} c="teal" mb={4}>Credits Applied This Session</Text>
              <Stack gap={2}>
                {appliedCredits.map((c, i) => (
                  <Group key={i} justify="space-between">
                    <Group gap={4}>
                      <ThemeIcon size={14} color="teal" variant="transparent">
                        <IconCheck size={12} />
                      </ThemeIcon>
                      <Text size="xs">{c.crNumber}</Text>
                    </Group>
                    <Text size="xs" fw={500} c="teal">{formatCurrency(c.amount)}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {/* Apply Credit Note button */}
          {invoice.clientId && effectiveBalance > 0 && (
            <Button
              variant="light"
              color="teal"
              leftSection={<IconReceipt size={16} />}
              onClick={() => setCnModalOpen(true)}
              disabled={isLoading}
            >
              Apply Credit Note
            </Button>
          )}

          {allCoveredByCredit ? (
            <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
              The full balance has been covered by credit notes. Click "Done" to finish.
            </Alert>
          ) : (
            <>
              <Divider label="Cash Payment" labelPosition="center" />

              <NumberInput
                ref={amountInputRef}
                label="Payment Amount"
                placeholder="0.00"
                value={amount}
                onChange={setAmount}
                onKeyDown={handleKeyDown}
                min={0}
                max={effectiveBalance}
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
                required
              />

              <TextInput
                label="Reference #"
                placeholder="e.g., Trace #, Auth code"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.currentTarget.value)}
                disabled={isLoading}
              />

              <Textarea
                label="Notes (optional)"
                placeholder="Payment notes..."
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                minRows={2}
                disabled={isLoading}
              />
            </>
          )}

          <Group justify="space-between" mt="md">
            {!allCoveredByCredit && (
              <Button
                variant="subtle"
                onClick={() => setAmount(effectiveBalance)}
                disabled={isLoading}
              >
                Pay Full Balance
              </Button>
            )}
            <Group gap="sm" ml="auto">
              <Button variant="subtle" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={isLoading}
                disabled={!allCoveredByCredit && (cashPayment <= 0 || !paymentMethodId)}
                leftSection={allCoveredByCredit ? <IconCheck size={16} /> : <IconCash size={16} />}
              >
                {allCoveredByCredit ? 'Done' : 'Record Payment'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Separate modal for applying credit notes */}
      <ApplyCreditNoteModal
        opened={cnModalOpen}
        onClose={() => setCnModalOpen(false)}
        onApplied={handleCreditApplied}
        invoiceId={invoice.id}
        invoiceNumber={invoice.invNumber}
        clientId={invoice.clientId}
        clientName={invoice.clientName}
        maxAmount={effectiveBalance}
      />
    </>
  );
}
