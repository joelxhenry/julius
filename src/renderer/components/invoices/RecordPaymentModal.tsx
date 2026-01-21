import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Group, Loader, NumberInput, Select, Textarea, TextInput, Alert, Checkbox, Badge, Divider } from '@mantine/core';
import { IconCash, IconAlertCircle, IconReceipt } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

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

interface CreditNote {
  id: number;
  crNumber: string;
  total: string;
  totalUsed: string;
  crDate: string;
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

  // Credit note state
  const [availableCreditNotes, setAvailableCreditNotes] = useState<CreditNote[]>([]);
  const [selectedCreditNoteId, setSelectedCreditNoteId] = useState<string | null>(null);
  const [creditNoteAmount, setCreditNoteAmount] = useState<number | string>('');
  const [useCreditNote, setUseCreditNote] = useState(false);
  const [isLoadingCreditNotes, setIsLoadingCreditNotes] = useState(false);

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

  // Load available credit notes for the client
  useEffect(() => {
    const loadCreditNotes = async () => {
      if (!invoice?.clientId) {
        setAvailableCreditNotes([]);
        return;
      }

      setIsLoadingCreditNotes(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, {
          clientId: invoice.clientId,
        });
        if (result.success && result.data) {
          setAvailableCreditNotes(result.data);
        }
      } catch (err) {
        console.error('Failed to load credit notes:', err);
      } finally {
        setIsLoadingCreditNotes(false);
      }
    };

    if (opened) {
      loadCreditNotes();
    }
  }, [opened, invoice?.clientId]);

  // Reset form when modal opens
  useEffect(() => {
    if (opened && invoice) {
      setAmount(balanceDue > 0 ? balanceDue : '');
      setTransactionReference('');
      setNotes('');
      setError(null);
      setUseCreditNote(false);
      setSelectedCreditNoteId(null);
      setCreditNoteAmount('');
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 100);
    }
  }, [opened, invoice, balanceDue]);

  // Calculate available credit for selected credit note
  const selectedCreditNote = availableCreditNotes.find(cn => cn.id.toString() === selectedCreditNoteId);
  const availableCreditAmount = selectedCreditNote
    ? parseFloat(selectedCreditNote.total) - parseFloat(selectedCreditNote.totalUsed)
    : 0;

  // Calculate effective amounts
  const creditApplied = useCreditNote && selectedCreditNote
    ? (typeof creditNoteAmount === 'number' ? creditNoteAmount : parseFloat(creditNoteAmount as string) || 0)
    : 0;
  const cashPayment = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;
  const totalPayment = creditApplied + cashPayment;

  const handleSubmit = useCallback(async () => {
    if (!invoice) return;
    if (!user) {
      setError('You must be logged in to record payments');
      return;
    }

    // Validate credit note if used
    if (useCreditNote) {
      if (!selectedCreditNoteId) {
        setError('Please select a credit note to apply');
        return;
      }
      if (creditApplied <= 0) {
        setError('Please enter a valid credit note amount');
        return;
      }
      if (creditApplied > availableCreditAmount + 0.01) {
        setError(`Credit note amount cannot exceed available credit ($${availableCreditAmount.toFixed(2)})`);
        return;
      }
    }

    // Validate cash payment if entered
    if (cashPayment > 0 && !paymentMethodId) {
      setError('Please select a payment method for cash payment');
      return;
    }

    // Validate total doesn't exceed balance
    if (totalPayment > balanceDue + 0.01) {
      setError(`Total payment cannot exceed balance due ($${balanceDue.toFixed(2)})`);
      return;
    }

    // Must have at least some payment
    if (totalPayment <= 0) {
      setError('Please enter a payment amount or apply credit');
      return;
    }

    const selectedMethod = cashPayment > 0 ? paymentMethods.find(pm => pm.id.toString() === paymentMethodId) : null;
    if (cashPayment > 0 && !selectedMethod) {
      setError('Selected payment method is invalid');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build entries array
      const entries: Array<{
        type: 'payment' | 'credit_note';
        paymentMethodCode?: string;
        creditNoteId?: number;
        amount: string;
        transactionReference?: string;
        notes?: string;
      }> = [];

      // Add credit note entry if used
      if (useCreditNote && selectedCreditNote && creditApplied > 0) {
        entries.push({
          type: 'credit_note',
          creditNoteId: selectedCreditNote.id,
          amount: creditApplied.toFixed(2),
          notes: `Applied from ${selectedCreditNote.crNumber}`,
        });
      }

      // Add cash payment entry if present
      if (cashPayment > 0 && selectedMethod) {
        entries.push({
          type: 'payment',
          paymentMethodCode: selectedMethod.code,
          amount: cashPayment.toFixed(2),
          transactionReference: transactionReference || undefined,
          notes: notes || undefined,
        });
      }

      // Use the new PROCESS_INVOICE_PAYMENT channel which handles everything
      const result = await window.electron.invoke(IpcChannel.PROCESS_INVOICE_PAYMENT, {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invNumber,
        clientId: invoice.clientId,
        processedById: user.id,
        payerName: invoice.clientName || 'Walk-in Customer',
        entries,
      });

      if (result.success) {
        const messages: string[] = [];
        if (creditApplied > 0) messages.push(`$${creditApplied.toFixed(2)} credit applied`);
        if (cashPayment > 0) messages.push(`$${cashPayment.toFixed(2)} payment recorded`);

        notifications.show({
          title: 'Payment Recorded',
          message: `${messages.join(' and ')} for invoice ${invoice.invNumber}`,
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
  }, [invoice, user, useCreditNote, selectedCreditNoteId, creditApplied, availableCreditAmount, cashPayment, paymentMethodId, totalPayment, balanceDue, paymentMethods, selectedCreditNote, notes, onPaymentRecorded, onClose]);

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
        <Stack gap={4} p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-light)', borderRadius: 'var(--mantine-radius-sm)' }}>
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

        {/* Credit Note Section - only show if client has available credit notes */}
        {availableCreditNotes.length > 0 && (
          <>
            <Divider label={<Group gap={4}><IconReceipt size={14} /><Text size="xs">Apply Credit Note</Text></Group>} labelPosition="center" />

            <Checkbox
              label="Apply credit note to this invoice"
              checked={useCreditNote}
              onChange={(e) => {
                setUseCreditNote(e.currentTarget.checked);
                if (!e.currentTarget.checked) {
                  setSelectedCreditNoteId(null);
                  setCreditNoteAmount('');
                }
              }}
              disabled={isLoading}
            />

            {useCreditNote && (
              <Stack gap="sm">
                <Select
                  label="Select Credit Note"
                  placeholder="Choose credit note"
                  value={selectedCreditNoteId}
                  onChange={(value) => {
                    setSelectedCreditNoteId(value);
                    // Auto-fill the max available amount
                    const cn = availableCreditNotes.find(c => c.id.toString() === value);
                    if (cn) {
                      const available = parseFloat(cn.total) - parseFloat(cn.totalUsed);
                      const maxApplicable = Math.min(available, balanceDue - cashPayment);
                      setCreditNoteAmount(maxApplicable > 0 ? maxApplicable : '');
                    }
                  }}
                  data={availableCreditNotes.map((cn) => {
                    const available = parseFloat(cn.total) - parseFloat(cn.totalUsed);
                    return {
                      value: cn.id.toString(),
                      label: `${cn.crNumber} - ${formatCurrency(available)} available`,
                    };
                  })}
                  disabled={isLoading || isLoadingCreditNotes}
                  rightSection={isLoadingCreditNotes ? <Loader size={14} /> : undefined}
                />

                {selectedCreditNote && (
                  <NumberInput
                    label={`Credit Amount (max ${formatCurrency(availableCreditAmount)})`}
                    placeholder="0.00"
                    value={creditNoteAmount}
                    onChange={setCreditNoteAmount}
                    min={0.01}
                    max={Math.min(availableCreditAmount, balanceDue)}
                    decimalScale={2}
                    fixedDecimalScale
                    prefix="$"
                    thousandSeparator=","
                    disabled={isLoading}
                  />
                )}
              </Stack>
            )}

            <Divider label={<Text size="xs">Cash Payment</Text>} labelPosition="center" />
          </>
        )}

        <NumberInput
          ref={amountInputRef}
          label={useCreditNote ? "Additional Cash Payment" : "Payment Amount"}
          description={useCreditNote ? "Enter 0 if paying entirely with credit" : undefined}
          placeholder="0.00"
          value={amount}
          onChange={setAmount}
          onKeyDown={handleKeyDown}
          min={0}
          max={balanceDue - creditApplied}
          decimalScale={2}
          fixedDecimalScale
          prefix="$"
          thousandSeparator=","
          disabled={isLoading}
          required={!useCreditNote}
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
          disabled={isLoading || isLoadingMethods || (useCreditNote && cashPayment === 0)}
          rightSection={isLoadingMethods ? <Loader size={14} /> : undefined}
          required={!useCreditNote || cashPayment > 0}
        />

        <TextInput
          label="Reference #"
          placeholder="e.g., Trace #, Auth code"
          value={transactionReference}
          onChange={(e) => setTransactionReference(e.currentTarget.value)}
          disabled={isLoading || (useCreditNote && cashPayment === 0)}
        />

        <Textarea
          label="Notes (optional)"
          placeholder="Payment notes..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          disabled={isLoading}
        />

        {/* Total Summary when using credit */}
        {useCreditNote && totalPayment > 0 && (
          <Stack gap={4} p="sm" style={{ backgroundColor: 'var(--mantine-color-blue-light)', borderRadius: 'var(--mantine-radius-sm)' }}>
            {creditApplied > 0 && (
              <Group justify="space-between">
                <Text size="sm">Credit Applied</Text>
                <Badge color="green" variant="light">{formatCurrency(creditApplied)}</Badge>
              </Group>
            )}
            {cashPayment > 0 && (
              <Group justify="space-between">
                <Text size="sm">Cash Payment</Text>
                <Badge color="blue" variant="light">{formatCurrency(cashPayment)}</Badge>
              </Group>
            )}
            <Divider my={4} />
            <Group justify="space-between">
              <Text size="sm" fw={600}>Total Payment</Text>
              <Badge color="green" size="lg">{formatCurrency(totalPayment)}</Badge>
            </Group>
          </Stack>
        )}

        <Group justify="space-between" mt="md">
          <Button
            variant="subtle"
            onClick={() => {
              if (useCreditNote && creditApplied > 0) {
                setAmount(balanceDue - creditApplied);
              } else {
                setAmount(balanceDue);
              }
            }}
            disabled={isLoading}
          >
            Pay Full Balance
          </Button>
          <Group gap="sm">
            <Button variant="subtle" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || totalPayment <= 0 || (cashPayment > 0 && !paymentMethodId)}
            >
              {isLoading ? <Loader size="xs" color="white" /> : 'Record Payment'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
