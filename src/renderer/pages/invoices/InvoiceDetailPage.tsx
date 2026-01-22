import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import { Box, Loader, Center, Alert, Badge, Text, ActionIcon, Group, Paper, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCash, IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import {
  RecordPaymentModal,
  CompactDetailHeader,
  CompactDetailInfoBar,
  InvoiceLineItemsReadOnly,
} from '../../components/invoices';
import { PaymentHistoryCard } from '../../components/payments';
import { CollapsibleSection } from '../../components/common';

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
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });
  const [paymentModalOpen, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);

  // Cache for adjacent invoices
  const invoiceCacheRef = useRef<Map<number, InvoiceCache>>(new Map());

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

        // Prefetch adjacent invoices
        prefetchAdjacentInvoices(cachedData.adjacentIds.previousId, cachedData.adjacentIds.nextId);
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

          // Prefetch adjacent invoices in background
          prefetchAdjacentInvoices(data.adjacentIds.previousId, data.adjacentIds.nextId);
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
  }, [id, navigate, loadInvoiceData, prefetchAdjacentInvoices]);

  // Navigate to previous/next invoice (same tab)
  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        // Use replaceCurrentTab to stay in the same tab
        replaceCurrentTab(`/invoices/${targetId}`);
      }
    },
    [replaceCurrentTab]
  );

  // Archive invoice
  const handleArchive = useCallback(async () => {
    if (!invoice) return;

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
  }, [invoice, navigate]);

  // Open payment modal
  const handleRecordPayment = useCallback(() => {
    openPaymentModal();
  }, [openPaymentModal]);

  // Handle payment recorded - refresh invoice data
  const handlePaymentRecorded = useCallback(async () => {
    if (!invoice) return;

    // Reload invoice to get updated totalPaid and status
    const updatedResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
    if (updatedResult.success && updatedResult.data) {
      setInvoice(updatedResult.data);
      // Also update the cache
      const cache = invoiceCacheRef.current;
      const cached = cache.get(invoice.id);
      if (cached) {
        cache.set(invoice.id, { ...cached, invoice: updatedResult.data });
      }
    }
  }, [invoice]);

  // Navigate to create credit note
  const handleCreateCreditNote = useCallback(() => {
    if (invoice) {
      navigate(`/credit-notes/new?invoiceId=${invoice.id}`);
    }
  }, [invoice, navigate]);

  // Navigate to client
  const handleViewClient = useCallback(() => {
    if (invoice?.clientId) {
      navigate(`/clients/${invoice.clientId}`);
    }
  }, [invoice, navigate]);

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
        {/* Back Button and Header */}
        <Group gap="sm" align="flex-start">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => replaceCurrentTab('/invoices')}
            title="Back to Invoices"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Box style={{ flex: 1 }}>
            {/* Compact Header with Status, Totals, and Actions */}
            <CompactDetailHeader
              invoice={invoice}
              adjacentIds={adjacentIds}
              onNavigateAdjacent={handleNavigateAdjacent}
              onRecordPayment={handleRecordPayment}
              onCreateCreditNote={handleCreateCreditNote}
              onViewClient={handleViewClient}
              onArchive={handleArchive}
            />
          </Box>
        </Group>

        {/* Compact Info Bar */}
        <CompactDetailInfoBar invoice={invoice} onViewClient={handleViewClient} />

        {/* Admin Override Info */}
        {invoice.adminOverrideById && (
          <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" title="Admin Override Applied" p="xs">
            <Text size="sm">
              This invoice was issued with an admin override.
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
      </Box>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        opened={paymentModalOpen}
        onClose={closePaymentModal}
        onPaymentRecorded={handlePaymentRecorded}
        invoice={invoice}
      />
    </>
  );
}
