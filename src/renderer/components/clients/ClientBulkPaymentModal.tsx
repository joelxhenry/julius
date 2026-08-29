import { useState, useEffect, useMemo, useCallback } from 'react';
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
  SegmentedControl,
  Checkbox,
  Table,
  ScrollArea,
  Box,
} from '@mantine/core';
import { IconCash, IconAlertCircle, IconCheck, IconListCheck, IconBolt, IconReceipt } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { STORE_CREDIT_METHOD_CODE, isStoreCreditMethod } from '../../../shared/constants/payments';
import { useAuth } from '../../contexts/AuthContext';

interface OutstandingInvoice {
  id: number;
  invNumber: string;
  invDate: string;
  total: string;
  totalPaid: string;
  balance: string;
  status: string;
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

type PaymentMode = 'automatic' | 'select';

interface ClientBulkPaymentModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: number;
  clientName: string | null;
}

const formatCurrency = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value || '0') : value;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

/**
 * Client-level payment of outstanding balances. Two modes:
 *  - Automatic: apply the amount FIFO (oldest first) across ALL outstanding invoices.
 *  - Select: operator picks which invoices; the amount is filled FIFO across that subset.
 * A live preview mirrors the backend allocation so the operator sees exactly
 * which invoices get paid (and which only partially) before committing.
 */
export function ClientBulkPaymentModal({
  opened,
  onClose,
  onSuccess,
  clientId,
  clientName,
}: ClientBulkPaymentModalProps) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(false);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);

  const [amount, setAmount] = useState<number | string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<PaymentMode>('automatic');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load outstanding invoices + payment methods when the modal opens.
  useEffect(() => {
    if (!opened) return;
    setAmount('');
    setTransactionReference('');
    setNotes('');
    setMode('automatic');
    setSelectedIds(new Set());
    setError(null);

    const loadInvoices = async () => {
      setIsLoadingInvoices(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CLIENT_OUTSTANDING_INVOICES, { clientId });
        if (result.success && result.data) {
          setInvoices(result.data);
        } else {
          setError(result.error || 'Failed to load outstanding invoices');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load outstanding invoices');
      } finally {
        setIsLoadingInvoices(false);
      }
    };

    const loadMethods = async () => {
      setIsLoadingMethods(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          setPaymentMethods(result.data);
          if (result.data.length > 0) {
            setPaymentMethodId(result.data[0].id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to load payment methods:', err);
      } finally {
        setIsLoadingMethods(false);
      }
    };

    const loadCreditNotes = async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, { clientId });
        if (result.success && result.data) {
          setCreditNotes(result.data);
        } else {
          setCreditNotes([]);
        }
      } catch (err) {
        console.error('Failed to load credit notes:', err);
        setCreditNotes([]);
      }
    };

    loadInvoices();
    loadMethods();
    loadCreditNotes();
  }, [opened, clientId]);

  const cashAmount = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;

  // The invoices the payment will actually target, in FIFO order (the backend
  // already returns the list oldest-first).
  const targetInvoices = useMemo(
    () => (mode === 'automatic' ? invoices : invoices.filter((inv) => selectedIds.has(inv.id))),
    [mode, invoices, selectedIds]
  );

  const totalOutstanding = useMemo(
    () => invoices.reduce((sum, inv) => sum + parseFloat(inv.balance), 0),
    [invoices]
  );
  const targetOutstanding = useMemo(
    () => targetInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance), 0),
    [targetInvoices]
  );

  // FIFO allocation preview - mirrors PaymentTransactionService.processClientBulkPayment.
  const allocations = useMemo(() => {
    const map = new Map<number, number>();
    let remaining = cashAmount;
    for (const inv of targetInvoices) {
      if (remaining <= 0.001) break;
      const applied = Math.min(remaining, parseFloat(inv.balance));
      map.set(inv.id, applied);
      remaining -= applied;
    }
    return map;
  }, [targetInvoices, cashAmount]);

  const totalApplied = useMemo(
    () => Array.from(allocations.values()).reduce((sum, v) => sum + v, 0),
    [allocations]
  );

  // Store credit: the selected method is credit-note funded, so the amount is
  // drawn from the client's available credit notes instead of cash.
  const selectedMethod = useMemo(
    () => paymentMethods.find((pm) => pm.id.toString() === paymentMethodId) ?? null,
    [paymentMethods, paymentMethodId]
  );
  const isStoreCredit = selectedMethod ? isStoreCreditMethod(selectedMethod) : false;
  const availableStoreCredit = useMemo(
    () => creditNotes.reduce((sum, cn) => sum + (parseFloat(cn.total) - parseFloat(cn.totalUsed)), 0),
    [creditNotes]
  );

  // The most that can be paid: capped by the target invoices' balance, and - for
  // store credit - by the credit available to draw from.
  const maxPayable = isStoreCredit ? Math.min(targetOutstanding, availableStoreCredit) : targetOutstanding;
  const isOverpayment = cashAmount > maxPayable + 0.01;
  const noSelection = mode === 'select' && selectedIds.size === 0;
  const noStoreCredit = isStoreCredit && availableStoreCredit <= 0.001;

  const toggleInvoice = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) =>
      prev.size === invoices.length ? new Set() : new Set(invoices.map((inv) => inv.id))
    );
  };

  const handleSubmit = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to record payments');
      return;
    }
    if (cashAmount <= 0) {
      setError('Please enter a payment amount');
      return;
    }
    if (!paymentMethodId) {
      setError('Please select a payment method');
      return;
    }
    if (mode === 'select' && selectedIds.size === 0) {
      setError('Please select at least one invoice');
      return;
    }
    if (!selectedMethod) {
      setError('Selected payment method is invalid');
      return;
    }
    if (isStoreCredit && cashAmount > availableStoreCredit + 0.01) {
      setError(`Amount cannot exceed available store credit (${formatCurrency(availableStoreCredit)})`);
      return;
    }
    if (isOverpayment) {
      setError(`Payment cannot exceed the outstanding balance (${formatCurrency(targetOutstanding)})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.PROCESS_CLIENT_BULK_PAYMENT, {
        clientId,
        processedById: user.id,
        payerName: clientName || 'Walk-in Customer',
        amount: cashAmount.toFixed(2),
        // Send the canonical store-credit code so the backend draws from credit
        // notes regardless of how the method row is coded locally.
        paymentMethodCode: isStoreCredit ? STORE_CREDIT_METHOD_CODE : selectedMethod.code,
        transactionReference: isStoreCredit ? undefined : transactionReference || undefined,
        notes: notes || undefined,
        invoiceIds: mode === 'select' ? Array.from(selectedIds) : undefined,
      });

      if (result.success) {
        const count = result.data?.allocations?.length ?? 0;
        notifications.show({
          title: 'Payment Recorded',
          message: `${formatCurrency(cashAmount)} applied across ${count} invoice${count === 1 ? '' : 's'}`,
          color: 'green',
        });
        onSuccess();
        onClose();
      } else {
        setError(result.error || 'Failed to record payment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    user,
    cashAmount,
    paymentMethodId,
    mode,
    selectedIds,
    isOverpayment,
    targetOutstanding,
    selectedMethod,
    isStoreCredit,
    availableStoreCredit,
    clientId,
    clientName,
    transactionReference,
    notes,
    onSuccess,
    onClose,
  ]);

  const rows = invoices.map((inv) => {
    const applied = allocations.get(inv.id) ?? 0;
    const balance = parseFloat(inv.balance);
    const isSelected = selectedIds.has(inv.id);
    const isTarget = mode === 'automatic' || isSelected;
    const isPartial = applied > 0.001 && applied < balance - 0.001;
    return (
      <Table.Tr key={inv.id}>
        {mode === 'select' && (
          <Table.Td>
            <Checkbox
              checked={isSelected}
              onChange={() => toggleInvoice(inv.id)}
              disabled={isSubmitting}
            />
          </Table.Td>
        )}
        <Table.Td>
          <Text size="sm" fw={500}>{inv.invNumber}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">{formatDate(inv.invDate)}</Text>
        </Table.Td>
        <Table.Td ta="right">
          <Text size="sm">{formatCurrency(balance)}</Text>
        </Table.Td>
        <Table.Td ta="right">
          {isTarget && applied > 0.001 ? (
            <Group gap={4} justify="flex-end" wrap="nowrap">
              <Text size="sm" fw={500} c="green">{formatCurrency(applied)}</Text>
              {isPartial && <Badge size="xs" color="yellow" variant="light">Partial</Badge>}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconCash size={20} />
          <Text fw={600}>Receive Payment</Text>
        </Group>
      }
      centered
      size="xl"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Client / outstanding summary */}
        <Group
          justify="space-between"
          p="sm"
          style={{
            backgroundColor: 'var(--mantine-color-gray-light)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Stack gap={0}>
            <Text size="sm" c="dimmed">Client</Text>
            <Text size="sm" fw={500}>{clientName || 'Walk-in Customer'}</Text>
          </Stack>
          <Stack gap={0} align="flex-end">
            <Text size="sm" c="dimmed">Total Outstanding</Text>
            <Text size="sm" fw={600} c={totalOutstanding > 0 ? 'red' : 'green'}>
              {formatCurrency(totalOutstanding)}
            </Text>
          </Stack>
        </Group>

        {isLoadingInvoices ? (
          <Group justify="center" p="xl">
            <Loader />
          </Group>
        ) : invoices.length === 0 ? (
          <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
            This client has no outstanding invoices.
          </Alert>
        ) : (
          <>
            <Group grow align="flex-start">
              <NumberInput
                label="Amount"
                placeholder="0.00"
                value={amount}
                onChange={setAmount}
                min={0}
                decimalScale={2}
                fixedDecimalScale
                prefix="$"
                thousandSeparator=","
                disabled={isSubmitting}
                required
              />
              <Select
                label="Payment Method"
                placeholder="Select payment method"
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                data={paymentMethods.map((pm) => ({ value: pm.id.toString(), label: pm.name }))}
                disabled={isSubmitting || isLoadingMethods}
                rightSection={isLoadingMethods ? <Loader size={14} /> : undefined}
                required
              />
            </Group>

            <Group grow align="flex-start">
              {!isStoreCredit && (
                <TextInput
                  label="Reference #"
                  placeholder="e.g., Trace #, Auth code"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.currentTarget.value)}
                  disabled={isSubmitting}
                />
              )}
              <Textarea
                label="Notes (optional)"
                placeholder="Payment notes..."
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
                autosize
                minRows={1}
                maxRows={3}
                disabled={isSubmitting}
              />
            </Group>

            {isStoreCredit && (
              <Alert
                color={noStoreCredit ? 'red' : 'teal'}
                variant="light"
                icon={<IconReceipt size={16} />}
              >
                {noStoreCredit ? (
                  'This client has no available store credit (credit notes) to draw from.'
                ) : (
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm">
                      Paying from store credit - drawn from available credit notes oldest-first.
                    </Text>
                    <Text size="sm" fw={600} c="teal" style={{ whiteSpace: 'nowrap' }}>
                      {formatCurrency(availableStoreCredit)} available
                    </Text>
                  </Group>
                )}
              </Alert>
            )}

            <Divider />

            <SegmentedControl
              fullWidth
              value={mode}
              onChange={(value) => setMode(value as PaymentMode)}
              disabled={isSubmitting}
              data={[
                {
                  value: 'automatic',
                  label: (
                    <Group gap={6} justify="center" wrap="nowrap">
                      <IconBolt size={16} />
                      <span>Automatic (FIFO)</span>
                    </Group>
                  ),
                },
                {
                  value: 'select',
                  label: (
                    <Group gap={6} justify="center" wrap="nowrap">
                      <IconListCheck size={16} />
                      <span>Select Invoices</span>
                    </Group>
                  ),
                },
              ]}
            />

            <Text size="xs" c="dimmed">
              {mode === 'automatic'
                ? 'The amount is applied to outstanding invoices oldest-first until it runs out.'
                : 'Pick the invoices to pay. The amount fills the selected invoices oldest-first.'}
            </Text>

            <ScrollArea.Autosize mah={280}>
              <Table highlightOnHover stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    {mode === 'select' && (
                      <Table.Th w={40}>
                        <Checkbox
                          checked={selectedIds.size === invoices.length && invoices.length > 0}
                          indeterminate={selectedIds.size > 0 && selectedIds.size < invoices.length}
                          onChange={toggleAll}
                          disabled={isSubmitting}
                        />
                      </Table.Th>
                    )}
                    <Table.Th>Invoice #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th ta="right">Balance</Table.Th>
                    <Table.Th ta="right">Will Apply</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{rows}</Table.Tbody>
              </Table>
            </ScrollArea.Autosize>

            {/* Allocation summary */}
            <Box
              p="sm"
              style={{
                border: '1px solid var(--mantine-color-gray-3)',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {mode === 'select' ? 'Selected Balance' : 'Outstanding'}
                </Text>
                <Text size="sm">{formatCurrency(targetOutstanding)}</Text>
              </Group>
              {isStoreCredit && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Store Credit Available</Text>
                  <Text size="sm" c="teal">{formatCurrency(availableStoreCredit)}</Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Amount Entered</Text>
                <Text size="sm">{formatCurrency(cashAmount)}</Text>
              </Group>
              <Divider my={6} />
              <Group justify="space-between">
                <Text size="sm" fw={500}>Will Apply</Text>
                <Text size="sm" fw={600} c="green">{formatCurrency(totalApplied)}</Text>
              </Group>
            </Box>

            {isOverpayment && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {isStoreCredit && cashAmount > availableStoreCredit + 0.01
                  ? `The amount exceeds the available store credit of ${formatCurrency(availableStoreCredit)}.`
                  : `The amount exceeds the ${mode === 'select' ? 'selected' : 'outstanding'} balance of ${formatCurrency(targetOutstanding)}.`}
              </Alert>
            )}

            <Group justify="space-between" mt="xs">
              <Button
                variant="subtle"
                onClick={() => setAmount(maxPayable)}
                disabled={isSubmitting || maxPayable <= 0}
              >
                {isStoreCredit ? 'Use Max Credit' : `Pay Full ${mode === 'select' ? 'Selected' : 'Outstanding'}`}
              </Button>
              <Group gap="sm">
                <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={isSubmitting}
                  disabled={cashAmount <= 0 || !paymentMethodId || isOverpayment || noSelection || noStoreCredit}
                  leftSection={<IconCash size={16} />}
                >
                  Record Payment
                </Button>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
