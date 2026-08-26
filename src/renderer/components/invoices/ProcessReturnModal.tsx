import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  NumberInput,
  Checkbox,
  Table,
  Divider,
  Box,
  Alert,
  SegmentedControl,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import {
  IconPackageExport,
  IconAlertCircle,
  IconCash,
  IconBuildingBank,
  IconReceipt,
  IconCreditCardRefund,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTaxRate } from '../../hooks';

interface Invoice {
  id: number;
  invNumber: string;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  salespersonId: number | null;
  total: string;
  totalPaid: string;
  isTaxable: boolean;
  subTotal: string;
  tax: string;
}

interface LineItem {
  id: number;
  sku: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  amount: string;
  isTaxable: boolean;
}

interface ProcessReturnModalProps {
  opened: boolean;
  onClose: () => void;
  onProcessed: () => void;
  invoice: Invoice;
  lineItems: LineItem[];
}

type RefundMethod = 'CASH' | 'BANK_TRANSFER' | 'CREDIT_NOTE' | 'CARD_VOID';

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'CARD_VOID', label: 'Card Void' },
];

const METHOD_LABELS: Record<RefundMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank Transfer',
  CREDIT_NOTE: 'Credit Note',
  CARD_VOID: 'Card Void',
};

const METHOD_ICON: Record<RefundMethod, React.ReactNode> = {
  CASH: <IconCash size={16} />,
  BANK_TRANSFER: <IconBuildingBank size={16} />,
  CREDIT_NOTE: <IconReceipt size={16} />,
  CARD_VOID: <IconCreditCardRefund size={16} />,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function computeLineAmount(qty: number, unitPrice: string, discount: string): number {
  const price = parseFloat(unitPrice || '0');
  const disc = parseFloat(discount || '0');
  const discountMultiplier = 1 - disc / 100;
  return qty * price * discountMultiplier;
}

export function ProcessReturnModal({
  opened,
  onClose,
  onProcessed,
  invoice,
  lineItems,
}: ProcessReturnModalProps) {
  const { user } = useAuth();
  const { taxRate } = useTaxRate();
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map());
  const [returnDate, setReturnDate] = useState<Date | null>(new Date());
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('CASH');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountPaid = parseFloat(invoice.totalPaid || '0');

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      const defaultSelection = new Map<number, number>();
      lineItems.forEach((item) => {
        defaultSelection.set(item.id, item.quantity);
      });
      setSelectedItems(defaultSelection);
      setReturnDate(new Date());
      setRefundMethod('CASH');
      setReference('');
    }
  }, [opened, lineItems]);

  const toggleItem = useCallback((itemId: number, maxQty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.set(itemId, maxQty);
      }
      return next;
    });
  }, []);

  const setItemQty = useCallback((itemId: number, qty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (qty <= 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, qty);
      }
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    let subTotal = 0;
    lineItems.forEach((item) => {
      const qty = selectedItems.get(item.id);
      if (qty !== undefined) {
        subTotal += computeLineAmount(qty, item.unitPrice, item.discount);
      }
    });
    const effectiveRate = invoice.isTaxable ? taxRate : 0;
    const tax = subTotal * effectiveRate;
    return { subTotal, tax, total: subTotal + tax };
  }, [selectedItems, lineItems, invoice.isTaxable, taxRate]);

  // Money can only be refunded up to what was actually paid. Any excess of the
  // return value simply reduces the invoice balance (handled by the reduction).
  const refundable = Math.min(totals.total, amountPaid);
  const isMoneyMethod =
    refundMethod === 'CASH' || refundMethod === 'BANK_TRANSFER' || refundMethod === 'CARD_VOID';
  const moneyRefundAmount = isMoneyMethod ? refundable : 0;
  const partialRefund = isMoneyMethod && refundable + 0.001 < totals.total;

  // A credit note is store credit against paid funds, so it may not exceed the
  // amount paid — mirrors the Create Credit Note rule.
  const creditNoteDisabled = amountPaid <= 0.001 || totals.total > amountPaid + 0.001;
  const creditNoteChosenButInvalid = refundMethod === 'CREDIT_NOTE' && creditNoteDisabled;

  const canSubmit = totals.total > 0 && !creditNoteChosenButInvalid;

  const handleSubmit = useCallback(async () => {
    if (totals.total <= 0) return;
    if (refundMethod === 'CREDIT_NOTE' && creditNoteDisabled) return;

    // Both money refunds and credit notes attribute the action to an operator.
    if (!user && (moneyRefundAmount > 0.001 || refundMethod === 'CREDIT_NOTE')) {
      notifications.show({
        title: 'Error',
        message: 'You must be logged in to process a refund',
        color: 'red',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const returnDateStr = returnDate
        ? returnDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const selectedLineItems = lineItems.filter((item) => selectedItems.has(item.id));

      // 1. Restore inventory for returned items
      const inventoryLineItems = selectedLineItems
        .filter((item) => item.sku)
        .map((item) => ({
          sku: item.sku,
          quantity: selectedItems.get(item.id) ?? 0,
        }));

      if (inventoryLineItems.length > 0) {
        const inventoryResult = await window.electron.invoke(
          IpcChannel.PROCESS_INVOICE_RETURN,
          { invNumber: invoice.invNumber, lineItems: inventoryLineItems, returnDate: returnDateStr },
        );
        if (!inventoryResult.success) {
          console.warn('Failed to restore inventory:', inventoryResult.error);
        }
      }

      // 2. Update the source invoice line items (reverse the sale)
      let newSubTotal = 0;
      for (const item of lineItems) {
        const returnedQty = selectedItems.get(item.id);
        if (returnedQty === undefined) {
          // Item not returned — keep as-is
          newSubTotal += computeLineAmount(item.quantity, item.unitPrice, item.discount);
        } else if (returnedQty >= item.quantity) {
          // Fully returned — remove the line item from the invoice
          await window.electron.invoke(IpcChannel.DELETE_DOCUMENT_LINE_ITEM, { id: item.id });
        } else {
          // Partially returned — reduce quantity and recalculate amount
          const remainingQty = item.quantity - returnedQty;
          const newAmount = computeLineAmount(remainingQty, item.unitPrice, item.discount);
          await window.electron.invoke(IpcChannel.UPDATE_DOCUMENT_LINE_ITEM, {
            id: item.id,
            data: {
              quantity: remainingQty.toString(),
              amount: newAmount.toFixed(2),
            },
          });
          newSubTotal += newAmount;
        }
      }

      // 3. Recalculate and update invoice totals
      const effectiveRate = invoice.isTaxable ? taxRate : 0;
      const newTax = newSubTotal * effectiveRate;
      const newTotal = newSubTotal + newTax;
      await window.electron.invoke(IpcChannel.UPDATE_INVOICE, {
        id: invoice.id,
        data: {
          subTotal: newSubTotal.toFixed(2),
          tax: newTax.toFixed(2),
          total: newTotal.toFixed(2),
        },
      });

      // 4. Process the refund according to the chosen method
      let refundSummary = '';

      if (refundMethod === 'CREDIT_NOTE') {
        // Issue store credit for the returned value. Inventory was already
        // restored above, so we do NOT restore it again here.
        const creditNoteData = {
          invNumber: invoice.invNumber,
          crDate: returnDateStr,
          salespersonId: invoice.salespersonId,
          clientId: invoice.clientId,
          clientName: invoice.clientName,
          clientAddress1: invoice.clientAddress1,
          clientAddress2: invoice.clientAddress2,
          clientPhone: invoice.clientPhone,
          reference: reference.trim() || 'Return',
          subTotal: totals.subTotal.toFixed(2),
          tax: totals.tax.toFixed(2),
          total: totals.total.toFixed(2),
          status: 'A',
        };

        const cnResult = await window.electron.invoke(IpcChannel.CREATE_CREDIT_NOTE, creditNoteData);
        if (!cnResult.success || !cnResult.data) {
          throw new Error(cnResult.error || 'Failed to create credit note');
        }

        const crNumber = cnResult.data.crNumber;
        for (let i = 0; i < selectedLineItems.length; i++) {
          const item = selectedLineItems[i];
          const qty = selectedItems.get(item.id) ?? 0;
          const amount = computeLineAmount(qty, item.unitPrice, item.discount);
          await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
            documentType: 'CREDIT',
            documentNumber: crNumber,
            lineNumber: i + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: qty.toString(),
            unitPrice: parseFloat(item.unitPrice).toFixed(2),
            discount: parseFloat(item.discount).toFixed(2),
            isTaxable: item.isTaxable,
            amount: amount.toFixed(2),
          });
        }

        refundSummary = `Credit note ${crNumber} for ${formatCurrency(totals.total)} issued as store credit.`;
      } else if (moneyRefundAmount > 0.001) {
        // Cash / bank transfer / card void — record a negative payment.
        if (!user) return; // guaranteed by the guard above; narrows the type
        const refundResult = await window.electron.invoke(IpcChannel.PROCESS_INVOICE_REFUND, {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invNumber,
          processedById: user.id,
          payerName: invoice.clientName,
          amount: moneyRefundAmount.toFixed(2),
          method: refundMethod,
          methodLabel: METHOD_LABELS[refundMethod],
          notes: reference.trim() || undefined,
        });
        if (!refundResult.success) {
          throw new Error(refundResult.error || 'Failed to record refund');
        }
        refundSummary = `${formatCurrency(moneyRefundAmount)} refunded via ${METHOD_LABELS[refundMethod]}.`;
        if (partialRefund) {
          refundSummary += ` (Limited to the amount paid; the remaining ${formatCurrency(totals.total - moneyRefundAmount)} reduced the balance.)`;
        }
      } else {
        // Nothing was paid — the return just reverses the sale.
        refundSummary = 'No payment was on file, so the sale was reversed with no refund.';
      }

      notifications.show({
        title: 'Return Processed',
        message: `${selectedLineItems.length} item${selectedLineItems.length !== 1 ? 's' : ''} returned. Inventory restored. ${refundSummary}`,
        color: 'green',
      });

      onProcessed();
      onClose();
    } catch (error) {
      console.error('Failed to process return:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to process return',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    totals,
    returnDate,
    invoice,
    lineItems,
    selectedItems,
    refundMethod,
    creditNoteDisabled,
    moneyRefundAmount,
    partialRefund,
    reference,
    user,
    taxRate,
    onProcessed,
    onClose,
  ]);

  const selectedCount = selectedItems.size;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPackageExport size={20} />
          <Text fw={600}>Process Return</Text>
        </Group>
      }
      size="xl"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Invoice info */}
        <Group gap="xl">
          <Box>
            <Text size="xs" c="dimmed">Source Invoice</Text>
            <Text fw={500}>{invoice.invNumber}</Text>
          </Box>
          {invoice.clientName && (
            <Box>
              <Text size="xs" c="dimmed">Client</Text>
              <Text fw={500}>{invoice.clientName}</Text>
            </Box>
          )}
          <Box>
            <Text size="xs" c="dimmed">Amount Paid</Text>
            <Text fw={500} c="green">{formatCurrency(amountPaid)}</Text>
          </Box>
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" p="xs">
          <Text size="xs">
            Select items to return, then choose how to refund the customer. Inventory is restored and the invoice is reduced accordingly.
          </Text>
        </Alert>

        {/* Return date */}
        <DateInput
          label="Return Date"
          value={returnDate}
          onChange={setReturnDate}
          maxDate={new Date()}
          size="sm"
          maw={240}
        />

        {/* Line items */}
        <Box>
          <Text fw={500} size="sm" mb="xs">
            Invoice Line Items
          </Text>
          <Box style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 4, overflow: 'hidden' }}>
            <Table striped highlightOnHover verticalSpacing={4} fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={36}></Table.Th>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th w={90} ta="right">Qty</Table.Th>
                  <Table.Th w={90} ta="right">Unit Price</Table.Th>
                  <Table.Th w={70} ta="right">Disc%</Table.Th>
                  <Table.Th w={90} ta="right">Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lineItems.map((item) => {
                  const isChecked = selectedItems.has(item.id);
                  const qty = selectedItems.get(item.id) ?? item.quantity;
                  const amount = isChecked
                    ? computeLineAmount(qty, item.unitPrice, item.discount)
                    : 0;

                  return (
                    <Table.Tr key={item.id} style={{ opacity: isChecked ? 1 : 0.45 }}>
                      <Table.Td>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => toggleItem(item.id, item.quantity)}
                          size="xs"
                        />
                      </Table.Td>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="xs" c="dimmed">{item.sku || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" truncate maw={160}>{item.description || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={isChecked ? qty : item.quantity}
                          onChange={(val) => setItemQty(item.id, Number(val))}
                          min={1}
                          max={item.quantity}
                          step={1}
                          disabled={!isChecked}
                          size="xs"
                          styles={{ input: { textAlign: 'right', width: 72 } }}
                          hideControls={false}
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{formatCurrency(parseFloat(item.unitPrice))}</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs">{parseFloat(item.discount).toFixed(1)}%</Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="xs" fw={isChecked ? 500 : 400}>
                          {formatCurrency(amount)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        </Box>

        {/* Refund method */}
        <Box>
          <Text fw={500} size="sm" mb="xs">Refund Method</Text>
          <SegmentedControl
            fullWidth
            value={refundMethod}
            onChange={(v) => setRefundMethod(v as RefundMethod)}
            data={REFUND_METHODS.map((m) => ({
              value: m.value,
              label: (
                <Group gap={6} justify="center" wrap="nowrap">
                  <ThemeIcon size={18} variant="transparent" c="inherit">
                    {METHOD_ICON[m.value]}
                  </ThemeIcon>
                  <Text size="xs">{m.label}</Text>
                </Group>
              ),
            }))}
          />
          <TextInput
            mt="xs"
            label={refundMethod === 'CREDIT_NOTE' ? 'Reference (optional)' : 'Reference / Note (optional)'}
            placeholder="e.g. return reason, trace #"
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
            size="sm"
          />

          {creditNoteChosenButInvalid && (
            <Alert mt="xs" icon={<IconAlertCircle size={16} />} color="orange" variant="light" p="xs">
              <Text size="xs">
                A credit note can’t exceed the amount paid ({formatCurrency(amountPaid)}). Reduce the
                selection or refund via cash, bank transfer, or card void.
              </Text>
            </Alert>
          )}
          {partialRefund && !creditNoteChosenButInvalid && (
            <Alert mt="xs" icon={<IconAlertCircle size={16} />} color="yellow" variant="light" p="xs">
              <Text size="xs">
                Only {formatCurrency(refundable)} can be refunded (the amount paid). The remaining{' '}
                {formatCurrency(totals.total - refundable)} will reduce the invoice balance.
              </Text>
            </Alert>
          )}
        </Box>

        {/* Totals */}
        <Divider />
        <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Stack gap={4} style={{ minWidth: 240 }}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Subtotal Reduction</Text>
              <Text size="sm">{formatCurrency(totals.subTotal)}</Text>
            </Group>
            {invoice.isTaxable && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Tax Reduction</Text>
                <Text size="sm">{formatCurrency(totals.tax)}</Text>
              </Group>
            )}
            <Group justify="space-between">
              <Text fw={600}>Invoice Reduction</Text>
              <Text fw={600} c={totals.total > 0 ? 'orange' : 'dimmed'}>
                {formatCurrency(totals.total)}
              </Text>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text fw={600}>
                {refundMethod === 'CREDIT_NOTE' ? 'Credit Note' : 'Refund'} ({METHOD_LABELS[refundMethod]})
              </Text>
              <Text fw={700} c={refundMethod === 'CREDIT_NOTE' ? 'teal' : 'red'}>
                {formatCurrency(refundMethod === 'CREDIT_NOTE' ? totals.total : moneyRefundAmount)}
              </Text>
            </Group>
          </Stack>
        </Box>

        {/* Actions */}
        <Group justify="space-between" mt="xs">
          <Text size="xs" c="dimmed">
            {selectedCount} of {lineItems.length} item{lineItems.length !== 1 ? 's' : ''} selected
          </Text>
          <Group gap="sm">
            <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              leftSection={<IconPackageExport size={16} />}
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!canSubmit}
              color="orange"
            >
              Process Return
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
