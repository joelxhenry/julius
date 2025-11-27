import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Select,
  Textarea,
  LoadingOverlay,
  Text,
  Badge,
  Menu,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconSend,
  IconCash,
  IconDotsVertical,
  IconTrash,
  IconPrinter,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';
import { InvoiceLineItemsGrid, type InvoiceLineItem } from '../../components/transactions/InvoiceLineItemsGrid';
import { InvoiceTotalsPanel } from '../../components/transactions/InvoiceTotalsPanel';
import { PaymentModal } from '../../components/transactions/PaymentModal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useInvoices, useClients, usePayments } from '../../hooks';
import { calculateInvoiceTotals, determineInvoiceStatus } from '../../utils/calculations';
import type { Invoice } from '../../../main/database/schema';
import type { PaymentFormData } from '../../utils/schemas';

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { getById: getInvoice, create, update } = useInvoices();
  const { clients } = useClients();
  const { create: createPayment } = usePayments();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentModalOpened, setPaymentModalOpened] = useState(false);

  // Form state
  const [clientId, setClientId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState<Date | null>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InvoiceLineItem[]>([
    {
      partVariantId: null,
      partName: '',
      quantity: 1,
      unitPrice: '0.00',
      discount: '0.00',
      taxRate: '0.00',
      lineTotal: 0,
    },
  ]);

  // Load existing invoice
  useEffect(() => {
    const loadInvoice = async () => {
      if (isNew) return;

      try {
        setLoading(true);
        const data = await getInvoice(parseInt(id!));
        setInvoice(data);
        setClientId(data.clientId?.toString() || null);
        setIssueDate(data.issueDate ? new Date(data.issueDate) : null);
        setDueDate(data.dueDate ? new Date(data.dueDate) : null);
        setNotes(data.notes || '');

        // Load line items from IPC
        const itemsResult = await window.electron.invoke('invoice-items:getByInvoice', {
          invoiceId: data.id,
        });
        const loadedItems = itemsResult.data || itemsResult || [];
        if (loadedItems.length > 0) {
          setItems(
            loadedItems.map((item: any) => ({
              id: item.id,
              partVariantId: item.partVariantId,
              partName: item.description || '',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || '0.00',
              taxRate: item.taxRate || '0.00',
              lineTotal: parseFloat(item.lineTotal) || 0,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [id, isNew, getInvoice]);

  // Calculate totals
  const totals = calculateInvoiceTotals(items);

  // Client options
  const clientOptions = clients.map((c) => ({
    value: c.id.toString(),
    label: c.name,
  }));

  const handleSave = async (shouldIssue: boolean = false) => {
    try {
      setSaving(true);

      // Validate
      if (items.length === 0 || items.every((item) => !item.partVariantId)) {
        notifications.show({
          title: 'Validation Error',
          message: 'Please add at least one line item',
          color: 'red',
        });
        return;
      }

      const invoiceData = {
        clientId: clientId ? parseInt(clientId) : null,
        issueDate: issueDate?.toISOString() || new Date().toISOString(),
        dueDate: dueDate?.toISOString() || null,
        subtotal: totals.subtotal.toString(),
        discount: totals.discountTotal.toString(),
        tax: totals.taxTotal.toString(),
        total: totals.total.toString(),
        balance: totals.total.toString(),
        status: shouldIssue ? 'ISSUED' : 'DRAFT',
        notes,
      };

      let invoiceId: number;

      if (isNew) {
        const result = await create(invoiceData);
        invoiceId = result.id;
      } else {
        await update(parseInt(id!), invoiceData);
        invoiceId = parseInt(id!);
      }

      // Save line items
      for (const item of items) {
        if (!item.partVariantId) continue;

        const itemData = {
          invoiceId,
          partVariantId: item.partVariantId,
          description: item.partName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal.toString(),
        };

        if (item.id) {
          await window.electron.invoke('invoice-items:update', {
            id: item.id,
            updates: itemData,
          });
        } else {
          await window.electron.invoke('invoice-items:create', itemData);
        }
      }

      notifications.show({
        title: 'Success',
        message: `Invoice ${shouldIssue ? 'issued' : 'saved'} successfully`,
        color: 'green',
      });

      if (isNew) {
        navigate(`/invoices/${invoiceId}`);
      } else {
        // Reload invoice
        const updated = await getInvoice(invoiceId);
        setInvoice(updated);
      }
    } catch (error) {
      console.error('Failed to save invoice:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save invoice',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async (paymentData: PaymentFormData) => {
    try {
      await createPayment(paymentData);

      // Reload invoice to update balance
      if (!isNew) {
        const updated = await getInvoice(parseInt(id!));
        setInvoice(updated);
      }
    } catch (error) {
      throw error;
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  const status = invoice?.status || 'DRAFT';
  const balance = invoice ? parseFloat(invoice.balance) : totals.total;
  const readonly = status === 'PAID' || status === 'CANCELLED';

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/invoices')}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New Invoice' : `Invoice #${invoice?.legacyId}`}
          </Title>
          {!isNew && <StatusBadge status={status} />}
        </Group>

        <Group>
          {!readonly && (
            <>
              <Button
                variant="light"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={() => handleSave(false)}
                loading={saving}
              >
                Save Draft
              </Button>
              <Button
                leftSection={<IconSend size={16} />}
                onClick={() => handleSave(true)}
                loading={saving}
              >
                {isNew ? 'Issue Invoice' : 'Update & Issue'}
              </Button>
            </>
          )}

          {!isNew && status !== 'PAID' && status !== 'CANCELLED' && (
            <Button
              variant="light"
              color="green"
              leftSection={<IconCash size={16} />}
              onClick={() => setPaymentModalOpened(true)}
            >
              Record Payment
            </Button>
          )}

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="light" size="lg">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPrinter size={14} />}>
                Print
              </Menu.Item>
              <Menu.Item leftSection={<IconTrash size={14} />} color="red">
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Paper withBorder p="md">
        <Stack>
          <Group grow align="flex-start">
            <Select
              label="Client"
              placeholder="Select client or leave blank for walk-in"
              data={clientOptions}
              value={clientId}
              onChange={setClientId}
              searchable
              clearable
              disabled={readonly}
            />

            <DateInput
              label="Issue Date"
              value={issueDate}
              onChange={setIssueDate}
              disabled={readonly}
            />

            <DateInput
              label="Due Date"
              value={dueDate}
              onChange={setDueDate}
              clearable
              disabled={readonly}
            />
          </Group>

          <Textarea
            label="Notes"
            placeholder="Additional notes for this invoice"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readonly}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="md">
          Line Items
        </Title>
        <InvoiceLineItemsGrid items={items} onChange={setItems} readonly={readonly} />
      </Paper>

      <InvoiceTotalsPanel
        subtotal={totals.subtotal}
        discountTotal={totals.discountTotal}
        taxTotal={totals.taxTotal}
        total={totals.total}
        balance={balance}
        showBalance={!isNew}
      />

      {!isNew && invoice && (
        <PaymentModal
          opened={paymentModalOpened}
          onClose={() => setPaymentModalOpened(false)}
          onSubmit={handlePayment}
          invoiceId={invoice.id}
          balance={balance}
        />
      )}
    </Stack>
  );
}
