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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPackageExport, IconAlertCircle } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface Invoice {
  id: number;
  invNumber: string;
  clientName: string | null;
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
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map());
  const [returnDate, setReturnDate] = useState<Date | null>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (opened) {
      const defaultSelection = new Map<number, number>();
      lineItems.forEach((item) => {
        defaultSelection.set(item.id, item.quantity);
      });
      setSelectedItems(defaultSelection);
      setReturnDate(new Date());
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
    const taxRate = invoice.isTaxable ? 0.1 : 0;
    const tax = subTotal * taxRate;
    return { subTotal, tax, total: subTotal + tax };
  }, [selectedItems, lineItems, invoice.isTaxable]);

  const handleSubmit = useCallback(async () => {
    if (totals.total <= 0) return;

    setIsSubmitting(true);
    try {
      const returnDateStr = returnDate
        ? returnDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      const selectedLineItems = lineItems.filter((item) => selectedItems.has(item.id));

      // Restore inventory for returned items
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

      // Update the source invoice line items
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

      // Recalculate and update invoice totals
      const taxRate = invoice.isTaxable ? 0.1 : 0;
      const newTax = newSubTotal * taxRate;
      const newTotal = newSubTotal + newTax;
      await window.electron.invoke(IpcChannel.UPDATE_INVOICE, {
        id: invoice.id,
        data: {
          subTotal: newSubTotal.toFixed(2),
          tax: newTax.toFixed(2),
          total: newTotal.toFixed(2),
        },
      });

      notifications.show({
        title: 'Return Processed',
        message: `${selectedLineItems.length} item${selectedLineItems.length !== 1 ? 's' : ''} returned. Invoice reduced by ${formatCurrency(totals.total)}. Inventory has been restored.`,
        color: 'green',
      });

      onProcessed();
      onClose();
    } catch (error) {
      console.error('Failed to process return:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to process return',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [totals, returnDate, invoice, lineItems, selectedItems, onProcessed, onClose]);

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
        </Group>

        <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" p="xs">
          <Text size="xs">
            Select items and quantities to return. Inventory will be restored and the invoice will be reduced accordingly. No financial credit note will be issued.
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
                  <Table.Th>SKU</Table.Th>
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

        {/* Totals */}
        <Divider />
        <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Stack gap={4} style={{ minWidth: 200 }}>
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
            <Divider />
            <Group justify="space-between">
              <Text fw={600}>Invoice Reduction</Text>
              <Text fw={600} c={totals.total > 0 ? 'orange' : 'dimmed'}>
                {formatCurrency(totals.total)}
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
              disabled={totals.total <= 0}
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
