import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import { Box, Loader, Center, Paper, Stack, Text, ActionIcon, Group, Button, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconFileInvoice } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { QuotationDetailHeader, QuotationDetailInfoBar } from '../../components/quotations';
import { InvoiceLineItemsReadOnly } from '../../components/invoices';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  salespersonId: number | null;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  reference: string | null;
  subTotal: string;
  tax: string;
  total: string;
  isTaxable: boolean;
  pricing: string;
  isArchived: boolean;
  notes: string | null;
  createdAt: string;
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
  isVariant: boolean;
}

// Cache for adjacent quotations to improve navigation performance
interface QuotationCache {
  quotation: Quotation;
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

export function QuotationDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });

  // Convert to invoice modal
  const [convertModalOpen, { open: openConvertModal, close: closeConvertModal }] = useDisclosure(false);
  const [isConverting, setIsConverting] = useState(false);

  // Cache for adjacent quotations
  const quotationCacheRef = useRef<Map<number, QuotationCache>>(new Map());

  // Update tab title when quotation loads (only when this tab is active)
  useEffect(() => {
    if (quotation && location.pathname === `/quotations/${id}`) {
      updateTabTitle(location.pathname, `Quote ${quotation.quoteNum}`);
    }
  }, [quotation, id, location.pathname, updateTabTitle]);

  // Helper function to load quotation data (used for both current and prefetching)
  const loadQuotationData = useCallback(async (quotationId: number): Promise<QuotationCache | null> => {
    try {
      // Load quotation
      const quoteResult = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id: quotationId });
      if (!quoteResult.success || !quoteResult.data) {
        return null;
      }

      // Load line items
      const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_QUOTATION, {
        quoteNum: quoteResult.data.quoteNum,
      });

      // Load adjacent quotations
      const adjResult = await window.electron.invoke(IpcChannel.GET_ADJACENT_QUOTATIONS, { id: quotationId });

      return {
        quotation: quoteResult.data,
        lineItems: itemsResult.success && itemsResult.data ? itemsResult.data : [],
        adjacentIds: adjResult.success && adjResult.data ? adjResult.data : { previousId: null, nextId: null },
      };
    } catch (error) {
      console.error('Failed to load quotation data:', error);
      return null;
    }
  }, []);

  // Prefetch adjacent quotations in background
  const prefetchAdjacentQuotations = useCallback(
    async (prevId: number | null, nextId: number | null) => {
      const cache = quotationCacheRef.current;

      // Prefetch previous quotation if not cached
      if (prevId && !cache.has(prevId)) {
        loadQuotationData(prevId).then((data) => {
          if (data) {
            cache.set(prevId, data);
          }
        });
      }

      // Prefetch next quotation if not cached
      if (nextId && !cache.has(nextId)) {
        loadQuotationData(nextId).then((data) => {
          if (data) {
            cache.set(nextId, data);
          }
        });
      }
    },
    [loadQuotationData]
  );

  // Load quotation data
  useEffect(() => {
    const loadQuotation = async () => {
      if (!id) return;

      const quotationId = parseInt(id, 10);
      const cache = quotationCacheRef.current;

      // Check if we have this quotation cached
      const cachedData = cache.get(quotationId);
      if (cachedData) {
        // Use cached data immediately
        setQuotation(cachedData.quotation);
        setLineItems(cachedData.lineItems);
        setAdjacentIds(cachedData.adjacentIds);
        setIsLoading(false);

        // Prefetch adjacent quotations
        prefetchAdjacentQuotations(cachedData.adjacentIds.previousId, cachedData.adjacentIds.nextId);
        return;
      }

      setIsLoading(true);
      try {
        const data = await loadQuotationData(quotationId);

        if (data) {
          // Cache the loaded data
          cache.set(quotationId, data);

          setQuotation(data.quotation);
          setLineItems(data.lineItems);
          setAdjacentIds(data.adjacentIds);

          // Prefetch adjacent quotations in background
          prefetchAdjacentQuotations(data.adjacentIds.previousId, data.adjacentIds.nextId);
        } else {
          notifications.show({
            title: 'Error',
            message: 'Quotation not found',
            color: 'red',
          });
          navigate('/quotations');
        }
      } catch (error) {
        console.error('Failed to load quotation:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load quotation',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadQuotation();
  }, [id, navigate, loadQuotationData, prefetchAdjacentQuotations]);

  // Navigate to previous/next quotation
  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        replaceCurrentTab(`/quotations/${targetId}`);
      }
    },
    [replaceCurrentTab]
  );

  // Convert quotation to active invoice
  const handleConvertToInvoice = useCallback(async () => {
    if (!quotation) return;

    setIsConverting(true);
    try {
      // Create a new invoice as active with quotation data
      const invoiceData = {
        invDate: new Date().toISOString().split('T')[0],
        salespersonId: quotation.salespersonId,
        clientId: quotation.clientId,
        clientName: quotation.clientName,
        clientAddress1: quotation.clientAddress1,
        clientAddress2: quotation.clientAddress2,
        clientPhone: quotation.clientPhone,
        reference: `Quote #${quotation.quoteNum}`,
        subTotal: quotation.subTotal,
        tax: quotation.tax,
        total: quotation.total,
        totalPaid: '0',
        status: 'active',
        isTaxable: quotation.isTaxable,
        pricing: quotation.pricing,
      };

      // Create the invoice
      const invoiceResult = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error || 'Failed to create invoice');
      }

      const newInvoice = invoiceResult.data;

      // Copy line items to the new invoice
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
          documentType: 'INVOICE',
          documentNumber: newInvoice.invNumber,
          lineNumber: i + 1,
          sku: item.sku || null,
          isVariant: item.isVariant || false,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice,
          discount: item.discount,
          isTaxable: item.isTaxable,
          amount: item.amount,
        });
      }

      // Archive the quotation (mark as converted)
      await window.electron.invoke(IpcChannel.ARCHIVE_QUOTATION, { id: quotation.id });

      notifications.show({
        title: 'Success',
        message: `Invoice ${newInvoice.invNumber} created from quotation`,
        color: 'green',
      });

      closeConvertModal();

      // Navigate to the new invoice
      replaceCurrentTab(`/invoices/${newInvoice.id}`);
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to convert quotation to invoice',
        color: 'red',
      });
    } finally {
      setIsConverting(false);
    }
  }, [quotation, lineItems, navigate, closeConvertModal]);

  // Edit quotation
  const handleEdit = useCallback(() => {
    if (quotation) {
      navigate(`/quotations/${quotation.id}/edit`);
    }
  }, [quotation, navigate]);

  // Archive quotation
  const handleArchive = useCallback(async () => {
    if (!quotation) return;

    try {
      const result = await window.electron.invoke(IpcChannel.ARCHIVE_QUOTATION, { id: quotation.id });
      if (result.success) {
        notifications.show({
          title: 'Quotation Archived',
          message: `Quotation ${quotation.quoteNum} has been archived`,
          color: 'green',
        });
        navigate('/quotations');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to archive quotation',
        color: 'red',
      });
    }
  }, [quotation, navigate]);

  // Mark as expired
  const handleExpire = useCallback(async () => {
    if (!quotation) return;

    try {
      const result = await window.electron.invoke(IpcChannel.EXPIRE_QUOTATION, { id: quotation.id });
      if (result.success) {
        notifications.show({
          title: 'Quotation Expired',
          message: `Quotation ${quotation.quoteNum} has been marked as expired`,
          color: 'orange',
        });
        // Reload to show updated status
        const updatedResult = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id: quotation.id });
        if (updatedResult.success && updatedResult.data) {
          setQuotation(updatedResult.data);
          // Update cache
          const cache = quotationCacheRef.current;
          const cached = cache.get(quotation.id);
          if (cached) {
            cache.set(quotation.id, { ...cached, quotation: updatedResult.data });
          }
        }
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to expire quotation',
        color: 'red',
      });
    }
  }, [quotation]);

  // Navigate to client
  const handleViewClient = useCallback(() => {
    if (quotation?.clientId) {
      navigate(`/clients/${quotation.clientId}`);
    }
  }, [quotation, navigate]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <>
      <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 8 }}>
        {/* Header with Back Button */}
        <Group gap="sm" align="center" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => replaceCurrentTab('/quotations')}
            title="Back to Quotations"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Box style={{ flex: 1 }}>
            <QuotationDetailHeader
              quotation={quotation}
              adjacentIds={adjacentIds}
              onNavigateAdjacent={handleNavigateAdjacent}
              onConvertToInvoice={openConvertModal}
              onEdit={handleEdit}
              onViewClient={handleViewClient}
              onExpire={handleExpire}
              onArchive={handleArchive}
            />
          </Box>
        </Group>

        {/* Compact Info Bar */}
        <QuotationDetailInfoBar quotation={quotation} onViewClient={handleViewClient} />

        {/* Notes */}
        {quotation.notes && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="xs">
              <Text fw={500} size="sm">Notes</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {quotation.notes}
              </Text>
            </Stack>
          </Paper>
        )}

        {/* Main Content: Line Items Table - Primary Focus */}
        <InvoiceLineItemsReadOnly
          lineItems={lineItems}
          subTotal={quotation.subTotal}
          tax={quotation.tax}
          total={quotation.total}
        />
      </Box>

      {/* Convert to Invoice Modal */}
      <Modal
        opened={convertModalOpen}
        onClose={closeConvertModal}
        title="Convert to Invoice"
        centered
      >
        <Stack gap="md">
          <Text>
            This will create a new <strong>active invoice</strong> from this quotation with:
          </Text>
          <Stack gap="xs">
            <Text size="sm">• Client: {quotation.clientName || 'Walk-in Customer'}</Text>
            <Text size="sm">• {lineItems.length} line items</Text>
            <Text size="sm">• Total: {formatCurrency(quotation.total)}</Text>
          </Stack>
          <Text size="sm" c="dimmed">
            The quotation will be archived after conversion.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeConvertModal}>
              Cancel
            </Button>
            <Button
              color="green"
              leftSection={<IconFileInvoice size={16} />}
              onClick={handleConvertToInvoice}
              loading={isConverting}
            >
              Create Invoice
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
