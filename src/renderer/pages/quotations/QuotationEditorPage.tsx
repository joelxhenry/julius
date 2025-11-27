import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Select,
  Textarea,
  LoadingOverlay,
  Menu,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconSend,
  IconFileInvoice,
  IconDotsVertical,
  IconTrash,
  IconPrinter,
} from '@tabler/icons-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';
import { InvoiceLineItemsGrid, type InvoiceLineItem } from '../../components/transactions/InvoiceLineItemsGrid';
import { InvoiceTotalsPanel } from '../../components/transactions/InvoiceTotalsPanel';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useQuotations, useClients } from '../../hooks';
import { useTabContext } from '../../contexts/TabContext';
import { useTabManager } from '../../contexts/TabManagerContext';
import { calculateInvoiceTotals } from '../../utils/calculations';
import type { Quotation } from '../../../main/database/schema';

interface QuotationEditorPageProps {
  id?: string;
}

export function QuotationEditorPage({ id }: QuotationEditorPageProps) {
  const { tabId } = useTabContext();
  const { openTab, closeTab, setTabDirty, setTabTitle } = useTabManager();
  const isNew = id === 'new' || !id;

  const { getById: getQuotation, create, update } = useQuotations();
  const { clients } = useClients();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [quotation, setQuotation] = useState<Quotation | null>(null);

  // Form state
  const [clientId, setClientId] = useState<string | null>(null);
  const [issueDate, setIssueDate] = useState<Date | null>(new Date());
  const [validUntil, setValidUntil] = useState<Date | null>(null);
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

  // Track initial load state for dirty tracking
  const initialLoadRef = useRef(true);
  const [isDirty, setIsDirty] = useState(false);

  // Update tab dirty state when form changes
  useEffect(() => {
    if (initialLoadRef.current) return;
    setIsDirty(true);
    setTabDirty(tabId, true);
  }, [clientId, issueDate, validUntil, notes, items, tabId, setTabDirty]);

  // Mark dirty state as clean after save
  const markClean = useCallback(() => {
    setIsDirty(false);
    setTabDirty(tabId, false);
  }, [tabId, setTabDirty]);

  // Load existing quotation
  useEffect(() => {
    const loadQuotation = async () => {
      if (isNew) {
        // Mark initial load complete after a short delay for new quotations
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 100);
        return;
      }

      try {
        setLoading(true);
        const data = await getQuotation(parseInt(id!));
        setQuotation(data);
        setClientId(data.clientId?.toString() || null);
        setIssueDate(data.issueDate ? new Date(data.issueDate) : null);
        setValidUntil(data.validUntil ? new Date(data.validUntil) : null);
        setNotes(data.notes || '');

        // Update tab title with actual quotation number
        setTabTitle(tabId, `Quotation #${data.id}`);

        // Load line items from IPC
        const itemsResult = await window.electron.invoke('quotation-items:getByQuotation', {
          quotationId: data.id,
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
        console.error('Failed to load quotation:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load quotation',
          color: 'red',
        });
      } finally {
        setLoading(false);
        // Mark initial load complete after data is loaded
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 100);
      }
    };

    loadQuotation();
  }, [id, isNew, getQuotation, tabId, setTabTitle]);

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

      const quotationData = {
        clientId: clientId ? parseInt(clientId) : null,
        issueDate: issueDate?.toISOString() || new Date().toISOString(),
        validUntil: validUntil?.toISOString() || null,
        subtotal: totals.subtotal.toString(),
        discount: totals.discountTotal.toString(),
        tax: totals.taxTotal.toString(),
        total: totals.total.toString(),
        status: shouldIssue ? 'ISSUED' : 'DRAFT',
        notes,
      };

      let quotationId: number;

      if (isNew) {
        const result = await create(quotationData);
        quotationId = result.id;
      } else {
        await update(parseInt(id!), quotationData);
        quotationId = parseInt(id!);
      }

      // Save line items
      for (const item of items) {
        if (!item.partVariantId) continue;

        const itemData = {
          quotationId,
          partVariantId: item.partVariantId,
          description: item.partName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal.toString(),
        };

        if (item.id) {
          await window.electron.invoke('quotation-items:update', {
            id: item.id,
            updates: itemData,
          });
        } else {
          await window.electron.invoke('quotation-items:create', itemData);
        }
      }

      notifications.show({
        title: 'Success',
        message: `Quotation ${shouldIssue ? 'issued' : 'saved'} successfully`,
        color: 'green',
      });

      // Mark form as clean after successful save
      markClean();

      if (isNew) {
        // Close this tab and open the new quotation tab
        closeTab(tabId, true);
        openTab({
          type: 'quotation-editor',
          path: `/quotations/${quotationId}`,
          title: `Quotation #${quotationId}`,
          entityId: quotationId.toString(),
        });
      } else {
        // Reload quotation
        const updated = await getQuotation(quotationId);
        setQuotation(updated);
      }
    } catch (error) {
      console.error('Failed to save quotation:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save quotation',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = async () => {
    if (!quotation) return;

    try {
      // Create invoice from quotation
      const invoiceData = {
        clientId: quotation.clientId,
        issueDate: new Date().toISOString(),
        dueDate: null,
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        tax: quotation.tax,
        total: quotation.total,
        balance: quotation.total,
        status: 'DRAFT',
        notes: `Converted from Quotation #${quotation.legacyId}${quotation.notes ? '\n' + quotation.notes : ''}`,
      };

      const invoiceResult = await window.electron.invoke('invoices:create', invoiceData);
      const invoice = invoiceResult.data || invoiceResult;

      // Copy line items
      const itemsResult = await window.electron.invoke('quotation-items:getByQuotation', {
        quotationId: quotation.id,
      });
      const quotationItems = itemsResult.data || itemsResult || [];

      for (const item of quotationItems) {
        await window.electron.invoke('invoice-items:create', {
          invoiceId: invoice.id,
          partVariantId: item.partVariantId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
        });
      }

      notifications.show({
        title: 'Success',
        message: 'Quotation converted to invoice',
        color: 'green',
      });

      // Open the new invoice in a tab
      openTab({
        type: 'invoice-editor',
        path: `/invoices/${invoice.id}`,
        title: `Invoice #${invoice.id}`,
        entityId: invoice.id.toString(),
      });
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to convert quotation to invoice',
        color: 'red',
      });
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  const status = quotation?.status || 'DRAFT';
  const readonly = status === 'ACCEPTED' || status === 'CANCELLED';

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => openTab({
              type: 'quotations-list',
              path: '/quotations',
              title: 'Quotations',
              entityId: null,
            })}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New Quotation' : `Quotation #${quotation?.legacyId}`}
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
                {isNew ? 'Issue Quotation' : 'Update & Issue'}
              </Button>
            </>
          )}

          {!isNew && status === 'ISSUED' && (
            <Button
              variant="light"
              color="green"
              leftSection={<IconFileInvoice size={16} />}
              onClick={handleConvertToInvoice}
            >
              Convert to Invoice
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
              label="Valid Until"
              value={validUntil}
              onChange={setValidUntil}
              clearable
              disabled={readonly}
            />
          </Group>

          <Textarea
            label="Notes"
            placeholder="Additional notes for this quotation"
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
      />
    </Stack>
  );
}
