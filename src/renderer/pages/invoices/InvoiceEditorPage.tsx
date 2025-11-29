import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  TextInput,
  Textarea,
  LoadingOverlay,
  Menu,
  ActionIcon,
  SimpleGrid,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconSend,
  IconCash,
  IconDotsVertical,
  IconTrash,
  IconPrinter,
  IconChevronLeft,
  IconChevronRight,
  IconUser,
  IconCopy,
  IconMail,
  IconReceipt,
} from '@tabler/icons-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { DateInput } from '@mantine/dates';
import { InvoiceLineItemsGrid, type InvoiceLineItem } from '../../components/transactions/InvoiceLineItemsGrid';
import { InvoiceViewMode } from '../../components/transactions/InvoiceViewMode';
import { IpcChannel } from '../../../shared/types/ipc';
import { InvoiceTotalsPanel } from '../../components/transactions/InvoiceTotalsPanel';
import { PaymentModal } from '../../components/transactions/PaymentModal';
import { AsyncSelect, type AsyncSelectOption } from '../../components/common/AsyncSelect';
import { useInvoices, useClients, usePayments, useInvoiceNavigation } from '../../hooks';
import { useTabContext } from '../../contexts/TabContext';
import { useTabManager } from '../../contexts/TabManagerContext';
import { calculateInvoiceTotals } from '../../utils/calculations';
import type { Invoice, Client } from '../../../main/database/schema';
import type { PaymentFormData } from '../../utils/schemas';

interface InvoiceEditorPageProps {
  id?: string;
}

export function InvoiceEditorPage({ id: initialId }: InvoiceEditorPageProps) {
  const { tabId } = useTabContext();
  const { openTab, closeTab, setTabDirty, setTabTitle } = useTabManager();

  // Track current invoice ID in state - this allows in-tab navigation without route changes
  const [currentId, setCurrentId] = useState(initialId);
  const isNew = currentId === 'new' || !currentId;
  const currentInvoiceId = isNew ? null : parseInt(currentId!);

  const { getById: getInvoice, create, update } = useInvoices();
  const { searchForSelect: searchClients } = useClients();
  const { create: createPayment } = usePayments();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentModalOpened, setPaymentModalOpened] = useState(false);

  // Form state
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState({
    name: '',
    address1: '',
    address2: '',
    phone: '',
    email: '',
  });
  const [clientCache, setClientCache] = useState<Map<string, Client>>(new Map());
  const [clientInitialOptions, setClientInitialOptions] = useState<AsyncSelectOption[]>([]);
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

  // Track initial load state for dirty tracking
  const initialLoadRef = useRef(true);

  // Helper function to populate form from invoice data
  // Using 'any' because the actual data from getInvoice may have additional fields not in the Invoice type
  const populateFormFromInvoice = useCallback(async (data: any) => {
    setInvoice(data);
    setClientId(data.clientId?.toString() || null);
    setClientInfo({
      name: data.clientName || '',
      address1: data.clientAddress1 || '',
      address2: data.clientAddress2 || '',
      phone: data.clientPhone || '',
      email: data.clientEmail || '',
    });

    // Set initial options for client AsyncSelect if client exists
    if (data.clientId && data.clientName) {
      setClientInitialOptions([{
        value: data.clientId.toString(),
        label: data.clientName,
      }]);
    } else {
      setClientInitialOptions([]);
    }

    setIssueDate(data.issueDate ? new Date(data.issueDate) : null);
    setDueDate(data.dueDate ? new Date(data.dueDate) : null);
    setNotes(data.notes || '');

    // Update tab title with actual invoice number
    if (data.invoiceNumber) {
      setTabTitle(tabId, `Invoice #${data.invoiceNumber}`);
    }

    // Load line items from IPC
    const itemsResult = await window.electron.invoke(IpcChannel.GET_INVOICE_ITEMS, {
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
    } else {
      setItems([{
        partVariantId: null,
        partName: '',
        quantity: 1,
        unitPrice: '0.00',
        discount: '0.00',
        taxRate: '0.00',
        lineTotal: 0,
      }]);
    }
  }, [tabId, setTabTitle]);

  // Handle navigation to a different invoice (in same tab)
  const handleNavigate = useCallback(async (invoiceId: number, cachedInvoice: any) => {
    // Update current ID immediately
    setCurrentId(invoiceId.toString());

    // Reset the fetchedForIdRef in navigation hook by changing ID
    initialLoadRef.current = true;

    if (cachedInvoice) {
      // Use cached data immediately - instant display!
      await populateFormFromInvoice(cachedInvoice);
      setLoading(false);

      // Refresh in background for consistency
      getInvoice(invoiceId).then(async (freshData) => {
        if (JSON.stringify(freshData) !== JSON.stringify(cachedInvoice)) {
          await populateFormFromInvoice(freshData);
        }
      }).catch(() => {
        // Silently fail - we already have data displayed
      });
    } else {
      // No cache - show loading and fetch
      setLoading(true);
      try {
        const data = await getInvoice(invoiceId);
        await populateFormFromInvoice(data);
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
    }

    // Mark initial load complete
    setTimeout(() => {
      initialLoadRef.current = false;
    }, 100);
  }, [getInvoice, populateFormFromInvoice]);

  // Use navigation hook with callback for in-tab navigation
  const { hasPrevious, hasNext, goToPrevious, goToNext } = useInvoiceNavigation(currentInvoiceId, {
    tabId,
    onNavigate: handleNavigate,
  });

  // Update tab dirty state when form changes
  useEffect(() => {
    if (initialLoadRef.current) return;
    setTabDirty(tabId, true);
  }, [clientId, clientInfo, issueDate, dueDate, notes, items, tabId, setTabDirty]);

  // Mark dirty state as clean after save
  const markClean = useCallback(() => {
    setTabDirty(tabId, false);
  }, [tabId, setTabDirty]);

  // Search function for client AsyncSelect
  const handleClientSearch = useCallback(async (query: string): Promise<AsyncSelectOption[]> => {
    const results = await searchClients(query, 20);
    // Cache the clients for later lookup
    setClientCache((prev) => {
      const newCache = new Map(prev);
      results.forEach((c) => {
        newCache.set(`${c.id}`, c);
      });
      return newCache;
    });

    return results.map((c) => ({
      value: c.id.toString(),
      label: c.name,
    }));
  }, [searchClients]);

  // Handle client selection - auto-fill client fields
  const handleClientChange = useCallback((value: string | null) => {
    setClientId(value);
    if (value) {
      const selectedClient = clientCache.get(value);
      if (selectedClient) {
        setClientInfo({
          name: selectedClient.name || '',
          address1: selectedClient.address1 || '',
          address2: selectedClient.address2 || '',
          phone: selectedClient.phone || '',
          email: selectedClient.email || '',
        });
      }
    } else {
      // Clear client fields for walk-in
      setClientInfo({
        name: '',
        address1: '',
        address2: '',
        phone: '',
        email: '',
      });
    }
  }, [clientCache]);

  // Load existing invoice on initial mount
  useEffect(() => {
    const loadInvoice = async () => {
      if (isNew) {
        // Mark initial load complete after a short delay for new invoices
        setTimeout(() => {
          initialLoadRef.current = false;
        }, 100);
        return;
      }

      const invoiceId = parseInt(currentId!);

      try {
        setLoading(true);
        const data = await getInvoice(invoiceId);
        await populateFormFromInvoice(data);
      } catch (error) {
        console.error('Failed to load invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
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

    loadInvoice();
    // Only run on initial mount - subsequent navigation is handled by handleNavigate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate totals
  const totals = calculateInvoiceTotals(items);

  const handleSave = async (shouldIssue = false) => {
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
        clientName: clientInfo.name || null,
        clientAddress1: clientInfo.address1 || null,
        clientAddress2: clientInfo.address2 || null,
        clientPhone: clientInfo.phone || null,
        clientEmail: clientInfo.email || null,
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
        await update(parseInt(currentId!), invoiceData);
        invoiceId = parseInt(currentId!);
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
          await window.electron.invoke(IpcChannel.UPDATE_INVOICE_ITEM, {
            id: item.id,
            data: itemData,
          });
        } else {
          await window.electron.invoke(IpcChannel.CREATE_INVOICE_ITEM, itemData);
        }
      }

      notifications.show({
        title: 'Success',
        message: `Invoice ${shouldIssue ? 'issued' : 'saved'} successfully`,
        color: 'green',
      });

      // Mark form as clean after successful save
      markClean();

      if (isNew) {
        // Close this tab and open the new invoice tab
        closeTab(tabId, true);
        openTab({
          type: 'invoice-editor',
          path: `/invoices/${invoiceId}`,
          title: `Invoice #${invoiceId}`,
          entityId: invoiceId.toString(),
        });
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
        const updated = await getInvoice(parseInt(currentId!));
        setInvoice(updated);
      }
    } catch (error) {
      throw error;
    }
  };

  // Compute derived values before hooks that depend on them
  const status = invoice?.status || 'DRAFT';
  const balance = invoice ? parseFloat(invoice.balance) : totals.total;
  // Only DRAFT invoices are editable; all other statuses are readonly
  const readonly = status !== 'DRAFT';

  // Handle duplicate invoice as new draft
  const handleDuplicate = useCallback(() => {
    if (!invoice) return;
    // Open new invoice with current data (will need to implement copy logic)
    notifications.show({
      title: 'Coming Soon',
      message: 'Duplicate functionality will be available soon',
      color: 'blue',
    });
  }, [invoice]);

  // Handle view client
  const handleViewClient = useCallback(() => {
    if (invoice?.clientId) {
      openTab({
        type: 'client-editor',
        path: `/clients/${invoice.clientId}`,
        title: clientInfo.name || 'Client',
        entityId: invoice.clientId.toString(),
      });
    }
  }, [invoice?.clientId, clientInfo.name, openTab]);

  // Handle email invoice
  const handleEmailInvoice = useCallback(() => {
    if (clientInfo.email) {
      notifications.show({
        title: 'Coming Soon',
        message: 'Email functionality will be available soon',
        color: 'blue',
      });
    }
  }, [clientInfo.email]);

  // Keyboard shortcuts for navigation and quick actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Navigation shortcuts (Alt+Arrow) - only for readonly invoices
      if (readonly && !isNew) {
        if (e.altKey && e.key === 'ArrowLeft' && hasPrevious) {
          e.preventDefault();
          goToPrevious();
          return;
        }
        if (e.altKey && e.key === 'ArrowRight' && hasNext) {
          e.preventDefault();
          goToNext();
          return;
        }
      }

      // Quick action shortcuts - only for existing invoices
      if (!isNew && invoice) {
        // Ctrl+Shift+C - View Client
        if (e.ctrlKey && e.shiftKey && e.key === 'C' && invoice.clientId) {
          e.preventDefault();
          handleViewClient();
          return;
        }
        // Ctrl+D - Duplicate as Draft (only for readonly)
        if (e.ctrlKey && !e.shiftKey && e.key === 'd' && readonly) {
          e.preventDefault();
          handleDuplicate();
          return;
        }
        // Ctrl+E - Email Invoice
        if (e.ctrlKey && !e.shiftKey && e.key === 'e' && clientInfo.email) {
          e.preventDefault();
          handleEmailInvoice();
          return;
        }
        // Ctrl+Shift+P - Record Payment (only for non-paid, non-cancelled)
        if (e.ctrlKey && e.shiftKey && e.key === 'P' && status !== 'PAID' && status !== 'CANCELLED') {
          e.preventDefault();
          setPaymentModalOpened(true);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    readonly,
    isNew,
    invoice,
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
    handleViewClient,
    handleDuplicate,
    handleEmailInvoice,
    clientInfo.email,
    status,
  ]);

  // Early return for loading state - MUST be after all hooks
  if (loading) {
    return <LoadingOverlay visible />;
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => openTab({
              type: 'invoices-list',
              path: '/invoices',
              title: 'Invoices',
              entityId: null,
            })}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New Invoice' : (readonly ? 'Invoice' : `Invoice #${invoice?.invoiceNumber}`)}
          </Title>

          {/* Navigation buttons for readonly (non-draft) invoices */}
          {readonly && !isNew && (
            <Group gap="xs" ml="md">
              <Tooltip label="Previous Invoice (Alt+←)">
                <ActionIcon
                  variant="light"
                  disabled={!hasPrevious}
                  onClick={goToPrevious}
                  size="lg"
                >
                  <IconChevronLeft size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Next Invoice (Alt+→)">
                <ActionIcon
                  variant="light"
                  disabled={!hasNext}
                  onClick={goToNext}
                  size="lg"
                >
                  <IconChevronRight size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Group>

        <Group>
          {/* Quick action buttons for existing invoices */}
          {!isNew && invoice && (
            <Group gap="xs">
              {invoice.clientId && (
                <Tooltip label="View Client (Ctrl+Shift+C)">
                  <ActionIcon variant="light" onClick={handleViewClient} size="lg">
                    <IconUser size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              <Tooltip label="View Payments">
                <ActionIcon variant="light" size="lg">
                  <IconReceipt size={18} />
                </ActionIcon>
              </Tooltip>
              {readonly && (
                <Tooltip label="Duplicate as Draft (Ctrl+D)">
                  <ActionIcon variant="light" onClick={handleDuplicate} size="lg">
                    <IconCopy size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
              {clientInfo.email && (
                <Tooltip label="Email Invoice (Ctrl+E)">
                  <ActionIcon variant="light" onClick={handleEmailInvoice} size="lg">
                    <IconMail size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          )}

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

      {/* Conditional rendering: View Mode (readonly) vs Edit Mode */}
      {readonly && invoice ? (
        <>
          <InvoiceViewMode
            invoiceNumber={invoice.invoiceNumber}
            status={status}
            clientInfo={clientInfo}
            issueDate={issueDate}
            dueDate={dueDate}
            notes={notes}
            items={items}
            subtotal={totals.subtotal}
            discountTotal={totals.discountTotal}
            taxTotal={totals.taxTotal}
            total={totals.total}
            balance={balance}
          />

          {invoice && (
            <PaymentModal
              opened={paymentModalOpened}
              onClose={() => setPaymentModalOpened(false)}
              onSubmit={handlePayment}
              invoiceId={invoice.id}
              balance={balance}
            />
          )}
        </>
      ) : (
        <>
          <Paper withBorder p="md">
            <Stack>
              <Group grow align="flex-start">
                <AsyncSelect
                  label="Client"
                  placeholder="Select client or leave blank for walk-in"
                  value={clientId}
                  onChange={handleClientChange}
                  onSearch={handleClientSearch}
                  initialOptions={clientInitialOptions}
                  clearable
                />

                <DateInput
                  label="Issue Date"
                  value={issueDate}
                  onChange={setIssueDate}
                />

                <DateInput
                  label="Due Date"
                  value={dueDate}
                  onChange={setDueDate}
                  clearable
                />
              </Group>

              {/* Client Details (editable snapshot) */}
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="Client Name"
                  placeholder="Walk-in Customer"
                  value={clientInfo.name}
                  onChange={(e) => setClientInfo((prev) => ({ ...prev, name: e.target.value }))}
                />
                <TextInput
                  label="Phone"
                  placeholder="Phone number"
                  value={clientInfo.phone}
                  onChange={(e) => setClientInfo((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <TextInput
                  label="Email"
                  placeholder="Email address"
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo((prev) => ({ ...prev, email: e.target.value }))}
                />
                <TextInput
                  label="Address Line 1"
                  placeholder="Street address"
                  value={clientInfo.address1}
                  onChange={(e) => setClientInfo((prev) => ({ ...prev, address1: e.target.value }))}
                />
                <TextInput
                  label="Address Line 2"
                  placeholder="City, Parish"
                  value={clientInfo.address2}
                  onChange={(e) => setClientInfo((prev) => ({ ...prev, address2: e.target.value }))}
                />
              </SimpleGrid>

              <Textarea
                label="Notes"
                placeholder="Additional notes for this invoice"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Title order={4} mb="md">
              Line Items
            </Title>
            <InvoiceLineItemsGrid items={items} onChange={setItems} readonly={false} />
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
        </>
      )}
    </Stack>
  );
}
