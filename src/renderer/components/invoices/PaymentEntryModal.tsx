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
} from '@mantine/core';
import { IconCash, IconAlertCircle, IconPlus, IconTrash, IconReceipt } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { STORE_CREDIT_METHOD_CODE, isStoreCreditMethod, isCashMethod } from '../../../shared/constants/payments';

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

interface CreditNote {
  total: string;
  totalUsed: string;
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
  const [availableStoreCredit, setAvailableStoreCredit] = useState(0);
  // Cash handover per entry index (display-only). Keyed by index; used to show the
  // change due for cash payments. Not part of PaymentEntry and never submitted.
  const [cashHandovers, setCashHandovers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Calculate total payment from all entries
  const totalPayment = paymentEntries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);

  const findMethod = useCallback(
    (code: string) => paymentMethods.find((pm) => pm.code === code) ?? null,
    [paymentMethods]
  );

  const entryIsStoreCredit = useCallback(
    (entry: PaymentEntry) => {
      const method = findMethod(entry.paymentMethodCode);
      return method ? isStoreCreditMethod(method) : false;
    },
    [findMethod]
  );

  const entryIsCash = useCallback(
    (entry: PaymentEntry) => {
      const method = findMethod(entry.paymentMethodCode);
      // The default 'CASH' code is used before methods load, so treat it as cash too.
      return method ? isCashMethod(method) : entry.paymentMethodCode === 'CASH';
    },
    [findMethod]
  );

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

  // Load the client's available store credit (from outstanding credit notes)
  useEffect(() => {
    if (!opened || !clientId) {
      setAvailableStoreCredit(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, { clientId });
        if (cancelled) return;
        if (result.success && Array.isArray(result.data)) {
          const total = (result.data as CreditNote[]).reduce(
            (sum, cn) => sum + (parseFloat(cn.total || '0') - parseFloat(cn.totalUsed || '0')),
            0
          );
          setAvailableStoreCredit(total);
        } else {
          setAvailableStoreCredit(0);
        }
      } catch (err) {
        console.error('Failed to load store credit:', err);
        if (!cancelled) setAvailableStoreCredit(0);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      setPaymentEntries([{ paymentMethodCode: 'CASH', amount: invoiceTotal.toFixed(2) }]);
      setCashHandovers({});
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
    // Re-index the display-only handover map so it stays aligned with the entries.
    setCashHandovers((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < index) next[i] = v;
        else if (i > index) next[i - 1] = v;
      });
      return next;
    });
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

  // Fill the last entry so the payment total covers the invoice balance.
  const handlePayFullBalance = useCallback(() => {
    setPaymentEntries((prev) => {
      if (prev.length === 0) return prev;
      const lastIndex = prev.length - 1;
      const others = prev.reduce(
        (sum, e, i) => (i === lastIndex ? sum : sum + parseFloat(e.amount || '0')),
        0
      );
      const remaining = Math.max(0, invoiceTotal - others);
      return prev.map((e, i) => (i === lastIndex ? { ...e, amount: remaining.toFixed(2) } : e));
    });
  }, [invoiceTotal]);

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

    // Validate store-credit entries against the client's available credit.
    const storeCreditTotal = paymentEntries.reduce(
      (sum, entry) => (entryIsStoreCredit(entry) ? sum + parseFloat(entry.amount || '0') : sum),
      0
    );
    if (storeCreditTotal > 0.001) {
      if (!clientId) {
        setError('Store credit requires a client on the invoice');
        return;
      }
      if (storeCreditTotal > availableStoreCredit + 0.01) {
        setError(
          `Store credit payment (${formatCurrency(storeCreditTotal)}) exceeds available store credit (${formatCurrency(availableStoreCredit)})`
        );
        return;
      }
    }

    // Send the canonical store-credit code so the backend draws from credit notes.
    const entriesToSubmit: PaymentEntry[] = paymentEntries.map((entry) => ({
      paymentMethodCode: entryIsStoreCredit(entry) ? STORE_CREDIT_METHOD_CODE : entry.paymentMethodCode,
      amount: entry.amount,
      transactionReference: entryIsStoreCredit(entry) ? undefined : entry.transactionReference || undefined,
      notes: entry.notes || undefined,
    }));

    onSubmit(entriesToSubmit);
  }, [paymentEntries, invoiceTotal, onSubmit, entryIsStoreCredit, clientId, availableStoreCredit]);

  // Store credit is only offered when the client actually has credit to draw from.
  const paymentMethodOptions = paymentMethods
    .filter((pm) => (isStoreCreditMethod(pm) ? clientId != null && availableStoreCredit > 0.001 : true))
    .map((pm) => ({ value: pm.code, label: pm.name }));

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
        {/* Summary - matches RecordPaymentModal's info block */}
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
          {paymentEntries.map((entry, index) => {
            const isStoreCredit = entryIsStoreCredit(entry);
            const isCash = entryIsCash(entry);
            const handoverRaw = cashHandovers[index] ?? '';
            const handoverAmount = parseFloat(handoverRaw || '0') || 0;
            const changeDue = Math.max(0, handoverAmount - parseFloat(entry.amount || '0'));
            return (
              <Stack key={index} gap="sm">
                {index > 0 && <Divider variant="dashed" />}

                {paymentEntries.length > 1 && (
                  <Group justify="space-between">
                    <Text size="xs" fw={600} c="dimmed">
                      Payment {index + 1}
                    </Text>
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => handleRemovePaymentEntry(index)}
                    >
                      Remove
                    </Button>
                  </Group>
                )}

                <Group grow align="flex-start">
                  <NumberInput
                    label="Amount"
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
                    required
                  />
                </Group>

                {isStoreCredit ? (
                  <Alert
                    color={availableStoreCredit > 0.001 ? 'teal' : 'red'}
                    variant="light"
                    icon={<IconReceipt size={16} />}
                  >
                    {availableStoreCredit > 0.001 ? (
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm">Paying from store credit - drawn from credit notes oldest-first.</Text>
                        <Text size="sm" fw={600} c="teal" style={{ whiteSpace: 'nowrap' }}>
                          {formatCurrency(availableStoreCredit)} available
                        </Text>
                      </Group>
                    ) : (
                      'This client has no available store credit.'
                    )}
                  </Alert>
                ) : (
                  <TextInput
                    label="Reference #"
                    placeholder="e.g., Trace #, Auth code"
                    value={entry.transactionReference || ''}
                    onChange={(event) => handleUpdateEntry(index, 'transactionReference', event.currentTarget.value)}
                  />
                )}

                {isCash && (
                  <Group grow align="flex-start">
                    <NumberInput
                      label="Cash Handover"
                      description="Cash received from the customer"
                      placeholder="0.00"
                      value={handoverRaw}
                      onChange={(value) =>
                        setCashHandovers((prev) => ({
                          ...prev,
                          [index]: typeof value === 'number' ? value.toFixed(2) : String(value ?? ''),
                        }))
                      }
                      min={0}
                      decimalScale={2}
                      fixedDecimalScale
                      prefix="$"
                      thousandSeparator=","
                    />
                    <Stack gap={2} justify="center">
                      <Text size="xs" c="dimmed">Change Due</Text>
                      <Text size="lg" fw={600} c={changeDue > 0 ? 'orange' : 'dimmed'}>
                        {formatCurrency(changeDue)}
                      </Text>
                    </Stack>
                  </Group>
                )}

                <Textarea
                  label="Notes (optional)"
                  placeholder="Payment notes..."
                  value={entry.notes || ''}
                  onChange={(event) => handleUpdateEntry(index, 'notes', event.currentTarget.value)}
                  autosize
                  minRows={1}
                  maxRows={3}
                />
              </Stack>
            );
          })}

          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={handleAddPaymentEntry} fullWidth>
            Add Another Payment Method
          </Button>
        </Stack>

        <Group justify="space-between" mt="md">
          <Button variant="subtle" onClick={handlePayFullBalance}>
            Pay Full Balance
          </Button>
          <Group gap="sm">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button leftSection={<IconCash size={16} />} onClick={handleSubmit}>
              Record Payment
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
