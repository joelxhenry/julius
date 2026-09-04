import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import { Box, Loader, Center, Alert, Badge, Text, ActionIcon, Group, Paper, Stack, Tooltip, Table } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCash, IconAlertTriangle, IconArrowLeft, IconReceipt, IconPlus, IconEye, IconRefresh } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import {
  RecordPaymentModal,
  CompactDetailHeader,
  CompactDetailInfoBar,
  InvoiceLineItemsReadOnly,
  ProcessReturnModal,
} from '../../components/invoices';
import { PaymentHistoryCard } from '../../components/payments';
import { CollapsibleSection, LookupTicketButton, PrintButton } from '../../components/common';
import { usePermissions } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  salespersonId: number | null;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  reference: string | null;
  notes: string | null;
  subTotal: string;
  tax: string;
  total: string;
  totalPaid: string;
  status: string;
  isTaxable: boolean;
  pricing: string;
  creditTerms: string | null;
  isArchived: boolean;
  issuedAt: string | null;
  issuedById: number | null;
  adminOverrideById: number | null;
  adminOverrideNotes: string | null;
  adminOverrideAt: string | null;
  createdAt: string;
  updatedAt: string;
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

interface CreditNote {
  id: number;
  crNumber: string;
  crDate: string;
  total: string;
  totalUsed: string;
  status: string;
  isArchived: boolean;
}

// Cache for adjacent invoices to improve navigation performance
interface InvoiceCache {
  invoice: Invoice;
  lineItems: LineItem[];
  adjacentIds: { previousId: number | null; nextId: number | null };
}

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export function InvoiceDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle, replaceCurrentTab, openTab } = useTabContext();
  const { runWithPermission } = usePermissions();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });
  const [paymentModalOpen, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);
  const [returnModalOpen, { open: openReturnModal, close: closeReturnModal }] = useDisclosure(false);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [salespersonName, setSalespersonName] = useState<string | null>(null);
  const [overrideAdminName, setOverrideAdminName] = useState<string | null>(null);

  // Cache for adjacent invoices
  const invoiceCacheRef = useRef<Map<number, InvoiceCache>>(new Map());

  // Fetch salesperson name when invoice loads
  useEffect(() => {
    if (!invoice?.salespersonId) { setSalespersonName(null); return; }
    window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: invoice.salespersonId }).then((res) => {
      if (res.success && res.data) {
        const emp = res.data;
        const name = employeeDisplayName(emp);
        setSalespersonName(name);
      }
    });
  }, [invoice?.salespersonId]);

  // Fetch the authorising admin's name for any override applied to this invoice
  useEffect(() => {
    if (!invoice?.adminOverrideById) { setOverrideAdminName(null); return; }
    window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: invoice.adminOverrideById }).then((res) => {
      if (res.success && res.data) {
        const emp = res.data;
        const name = employeeDisplayName(emp);
        setOverrideAdminName(name);
      }
    });
  }, [invoice?.adminOverrideById]);

  // Update tab title when invoice loads (only when this tab is active)
  useEffect(() => {
    if (invoice && location.pathname === `/invoices/${id}`) {
      updateTabTitle(location.pathname, `Invoice ${invoice.invNumber}`);
    }
  }, [invoice, id, location.pathname, updateTabTitle]);

  // Helper function to load invoice data (used for both current and prefetching)
  const loadInvoiceData = useCallback(async (invoiceId: number): Promise<InvoiceCache | null> => {
    try {
      // Load invoice
      const invResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoiceId });
      if (!invResult.success || !invResult.data) {
        return null;
      }

      // Load line items
      const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_INVOICE, {
        invNumber: invResult.data.invNumber,
      });

      // Load adjacent invoices
      const adjResult = await window.electron.invoke(IpcChannel.GET_ADJACENT_INVOICES, { id: invoiceId });

      return {
        invoice: invResult.data,
        lineItems: itemsResult.success && itemsResult.data ? itemsResult.data : [],
        adjacentIds: adjResult.success && adjResult.data ? adjResult.data : { previousId: null, nextId: null },
      };
    } catch (error) {
      console.error('Failed to load invoice data:', error);
      return null;
    }
  }, []);

  // Load credit notes for this invoice
  const loadCreditNotes = useCallback(async (invNumber: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_BY_INVOICE, { invNumber });
      if (result.success && result.data) {
        setCreditNotes(result.data);
      }
    } catch (error) {
      console.error('Failed to load credit notes:', error);
    }
  }, []);

  // Prefetch adjacent invoices in background
  const prefetchAdjacentInvoices = useCallback(
    async (prevId: number | null, nextId: number | null) => {
      const cache = invoiceCacheRef.current;

      // Prefetch previous invoice if not cached
      if (prevId && !cache.has(prevId)) {
        loadInvoiceData(prevId).then((data) => {
          if (data) {
            cache.set(prevId, data);
          }
        });
      }

      // Prefetch next invoice if not cached
      if (nextId && !cache.has(nextId)) {
        loadInvoiceData(nextId).then((data) => {
          if (data) {
            cache.set(nextId, data);
          }
        });
      }
    },
    [loadInvoiceData]
  );

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) return;

      const invoiceId = parseInt(id, 10);
      const cache = invoiceCacheRef.current;

      // Check if we have this invoice cached
      const cachedData = cache.get(invoiceId);
      if (cachedData) {
        // Use cached data immediately
        setInvoice(cachedData.invoice);
        setLineItems(cachedData.lineItems);
        setAdjacentIds(cachedData.adjacentIds);
        setIsLoading(false);

        // Prefetch adjacent invoices and load credit notes
        prefetchAdjacentInvoices(cachedData.adjacentIds.previousId, cachedData.adjacentIds.nextId);
        loadCreditNotes(cachedData.invoice.invNumber);
        return;
      }

      setIsLoading(true);
      try {
        const data = await loadInvoiceData(invoiceId);

        if (data) {
          // Cache the loaded data
          cache.set(invoiceId, data);

          setInvoice(data.invoice);
          setLineItems(data.lineItems);
          setAdjacentIds(data.adjacentIds);

          // Prefetch adjacent invoices in background and load credit notes
          prefetchAdjacentInvoices(data.adjacentIds.previousId, data.adjacentIds.nextId);
          loadCreditNotes(data.invoice.invNumber);
        } else {
          notifications.show({
            title: 'Error',
            message: 'Invoice not found',
            color: 'red',
          });
          navigate('/invoices');
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadInvoice();
  }, [id, navigate, loadInvoiceData, prefetchAdjacentInvoices, loadCreditNotes]);

  // Navigate to previous/next invoice (same tab)
  const fromListing = location.state?.fromListing === true;

  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        // Use replaceCurrentTab to stay in the same tab, preserve fromListing state
        replaceCurrentTab(`/invoices/${targetId}`, { fromListing: true });
      }
    },
    [replaceCurrentTab]
  );

  // Archive invoice
  const handleArchive = useCallback(() => {
    if (!invoice) return;
    runWithPermission(
      { permissionCode: 'ARCHIVE_INVOICE', actionLabel: `Archive invoice ${invoice.invNumber}`, context: { entity: 'invoice', id: invoice.id } },
      async () => {
        try {
          const result = await window.electron.invoke(IpcChannel.ARCHIVE_INVOICE, { id: invoice.id });
          if (result.success) {
            notifications.show({
              title: 'Invoice Archived',
              message: `Invoice ${invoice.invNumber} has been archived`,
              color: 'green',
            });
            navigate('/invoices');
          }
        } catch (error) {
          notifications.show({
            title: 'Error',
            message: 'Failed to archive invoice',
            color: 'red',
          });
        }
      }
    );
  }, [invoice, navigate, runWithPermission]);

  // Open payment modal (gated: recording a payment requires CREATE_PAYMENT)
  const handleRecordPayment = useCallback(() => {
    runWithPermission(
      { permissionCode: 'CREATE_PAYMENT', actionLabel: 'Record invoice payment', context: { entity: 'invoice', id: invoice?.id } },
      () => openPaymentModal()
    );
  }, [openPaymentModal, invoice, runWithPermission]);

  // Handle payment recorded or voided - refresh invoice and credit notes
  const handlePaymentRecorded = useCallback(async () => {
    if (!invoice) return;

    // Reload invoice to get updated totalPaid and status
    const updatedResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
    if (updatedResult.success && updatedResult.data) {
      setInvoice(updatedResult.data);
      const cache = invoiceCacheRef.current;
      const cached = cache.get(invoice.id);
      if (cached) {
        cache.set(invoice.id, { ...cached, invoice: updatedResult.data });
      }
    }

    // Also reload credit notes - a void may have restored a credit note's balance,
    // and a credit application changes its used amount
    loadCreditNotes(invoice.invNumber);
  }, [invoice, loadCreditNotes]);

  // Process return - available on any invoice regardless of payment
  const handleProcessReturn = useCallback(() => {
    if (!invoice) return;
    runWithPermission(
      { permissionCode: 'PROCESS_RETURN', actionLabel: `Process return for ${invoice.invNumber}`, context: { entity: 'invoice', id: invoice.id } },
      () => openReturnModal()
    );
  }, [openReturnModal, invoice, runWithPermission]);

  // Refresh invoice and line items after a return is processed
  const handleReturnProcessed = useCallback(async () => {
    if (!invoice) return;
    const cache = invoiceCacheRef.current;

    // Reload invoice totals
    const updatedInv = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
    if (updatedInv.success && updatedInv.data) {
      setInvoice(updatedInv.data);
      const cached = cache.get(invoice.id);
      if (cached) cache.set(invoice.id, { ...cached, invoice: updatedInv.data });
    }

    // Reload line items
    const updatedItems = await window.electron.invoke(
      IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_INVOICE,
      { invNumber: invoice.invNumber }
    );
    if (updatedItems.success && updatedItems.data) {
      setLineItems(updatedItems.data);
      const cached = cache.get(invoice.id);
      if (cached) cache.set(invoice.id, { ...cached, lineItems: updatedItems.data });
    }

    // A credit-note refund creates a credit note; reload so it appears.
    loadCreditNotes(invoice.invNumber);
  }, [invoice, loadCreditNotes]);

  // Navigate to client
  const handleViewClient = useCallback(() => {
    if (invoice?.clientId) {
      navigate(`/clients/${invoice.clientId}`);
    }
  }, [invoice, navigate]);

  // Refresh all page content (bypass cache)
  const handleRefresh = useCallback(async () => {
    if (!invoice) return;
    const data = await loadInvoiceData(invoice.id);
    if (data) {
      invoiceCacheRef.current.set(invoice.id, data);
      setInvoice(data.invoice);
      setLineItems(data.lineItems);
      setAdjacentIds(data.adjacentIds);
      loadCreditNotes(data.invoice.invNumber);
    }
  }, [invoice, loadInvoiceData, loadCreditNotes]);

  // Navigate to edit invoice
  const handleEdit = useCallback(() => {
    if (!invoice) return;
    runWithPermission(
      { permissionCode: 'EDIT_INVOICE', actionLabel: `Edit invoice ${invoice.invNumber}`, context: { entity: 'invoice', id: invoice.id } },
      () => replaceCurrentTab(`/invoices/edit/${invoice.id}`)
    );
  }, [invoice, replaceCurrentTab, runWithPermission]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!invoice) {
    return null;
  }

  return (
    <>
      <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 8 }}>
        {/* Header with Back Button */}
        <Group gap="sm" align="center" wrap="nowrap">
          {fromListing ? (
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => replaceCurrentTab('/invoices')}
              title="Back to Invoices"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          ) : (
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => replaceCurrentTab('/invoices/form')}
              title="New Invoice"
            >
              <IconPlus size={20} />
            </ActionIcon>
          )}
          <Box style={{ flex: 1 }}>
            <CompactDetailHeader
              invoice={invoice}
              adjacentIds={fromListing ? adjacentIds : { previousId: null, nextId: null }}
              onNavigateAdjacent={fromListing ? handleNavigateAdjacent : undefined}
              onRecordPayment={handleRecordPayment}
              onProcessReturn={handleProcessReturn}
              onViewClient={handleViewClient}
              onArchive={handleArchive}
              onEdit={handleEdit}
            />
          </Box>
          <ActionIcon variant="subtle" size="lg" onClick={handleRefresh} title="Refresh">
            <IconRefresh size={20} />
          </ActionIcon>
          <LookupTicketButton source="invoice" invoiceId={invoice.id} sourceReference={`Invoice #${invoice.invNumber}`} />
          <PrintButton documentType="invoice" documentId={invoice.id} />
        </Group>

        {/* Compact Info Bar */}
        <CompactDetailInfoBar
          invoice={invoice}
          onViewClient={handleViewClient}
          salespersonName={salespersonName}
          onViewSalesperson={() => invoice.salespersonId && openTab(`/employees/${invoice.salespersonId}`)}
        />

        {/* Admin Override Info */}
        {invoice.adminOverrideById && (
          <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" title="Admin Override Applied" p="xs">
            <Text size="sm">
              This invoice was issued with an admin override
              {overrideAdminName ? <> authorised by <strong>{overrideAdminName}</strong></> : ''}
              {invoice.adminOverrideAt ? ` on ${new Date(invoice.adminOverrideAt).toLocaleString()}` : ''}.
              {invoice.adminOverrideNotes && ` Notes: ${invoice.adminOverrideNotes}`}
            </Text>
          </Alert>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Text fw={500} size="sm">Notes</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {invoice.notes}
              </Text>
            </Stack>
          </Paper>
        )}

        {/* Main Content: Line Items Table - Primary Focus */}
        <InvoiceLineItemsReadOnly
          lineItems={lineItems}
          subTotal={invoice.subTotal}
          tax={invoice.tax}
          total={invoice.total}
        />

        {/* Collapsible: Payment History */}
        <CollapsibleSection
          title="Payment History"
          icon={<IconCash size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />}
          badge={
            parseFloat(invoice.totalPaid) > 0 ? (
              <Badge variant="light" color="green" size="sm">
                {formatCurrency(invoice.totalPaid)} paid
              </Badge>
            ) : undefined
          }
        >
          <PaymentHistoryCard
            key={invoice.totalPaid}
            invoiceNumber={invoice.invNumber}
            invoiceTotal={parseFloat(invoice.total)}
            totalPaid={parseFloat(invoice.totalPaid)}
            onPaymentVoided={handlePaymentRecorded}
          />
        </CollapsibleSection>

        {/* Collapsible: Credit Notes */}
        <CollapsibleSection
          title="Credit Notes"
          icon={<IconReceipt size={18} style={{ color: 'var(--mantine-color-dimmed)' }} />}
          badge={
            creditNotes.length > 0 ? (
              <Badge variant="light" color="teal" size="sm">
                {creditNotes.length}
              </Badge>
            ) : undefined
          }
        >
          <Stack gap="xs">
            {creditNotes.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="sm">
                No credit notes issued for this invoice
              </Text>
            ) : (
              <Table verticalSpacing={4} fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>CR #</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                    <Table.Th ta="right">Remaining</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th w={40}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {creditNotes.map((cn) => {
                    const remaining = parseFloat(cn.total) - parseFloat(cn.totalUsed);
                    const effectiveStatus = cn.isArchived ? 'archived' : cn.status;
                    const statusColor = effectiveStatus === 'A' ? 'green' : 'gray';
                    const statusLabel = effectiveStatus === 'A' ? 'Active' : effectiveStatus === 'U' ? 'Used' : 'Archived';
                    const crDate = new Date(cn.crDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                    return (
                      <Table.Tr key={cn.id}>
                        <Table.Td><Text fw={500} size="sm">{cn.crNumber}</Text></Table.Td>
                        <Table.Td><Text size="sm">{crDate}</Text></Table.Td>
                        <Table.Td ta="right"><Text size="sm">{formatCurrency(cn.total)}</Text></Table.Td>
                        <Table.Td ta="right">
                          <Text size="sm" c={remaining > 0 ? 'green' : 'dimmed'}>{formatCurrency(remaining.toString())}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={statusColor}>{statusLabel}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label="View Credit Note">
                            <ActionIcon variant="subtle" size="sm" onClick={() => openTab(`/credit-notes/${cn.id}`)}>
                              <IconEye size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </CollapsibleSection>
      </Box>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        opened={paymentModalOpen}
        onClose={closePaymentModal}
        onPaymentRecorded={handlePaymentRecorded}
        onCreditApplied={handlePaymentRecorded}
        invoice={invoice}
      />

      {/* Process Return Modal */}
      <ProcessReturnModal
        opened={returnModalOpen}
        onClose={closeReturnModal}
        onProcessed={handleReturnProcessed}
        invoice={invoice}
        lineItems={lineItems}
      />
    </>
  );
}
