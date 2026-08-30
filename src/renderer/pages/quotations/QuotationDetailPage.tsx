import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import { Box, Loader, Center, Paper, Stack, Text, ActionIcon, Group, Button, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconFileInvoice, IconPlus } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { QuotationDetailHeader, QuotationDetailInfoBar, PriceChangeWarningModal } from '../../components/quotations';
import type { PriceChange } from '../../components/quotations';
import { InvoiceLineItemsReadOnly } from '../../components/invoices';
import { LookupTicketButton, PrintButton } from '../../components/common';
import { useTaxRate } from '../../hooks';
import { usePermissions } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';

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
  const { updateTabTitle, replaceCurrentTab, openTab } = useTabContext();
  const { runWithPermission } = usePermissions();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });
  const [salespersonName, setSalespersonName] = useState<string | null>(null);

  // Convert to invoice modal
  const [convertModalOpen, { open: openConvertModal, close: closeConvertModal }] = useDisclosure(false);
  const [isConverting, setIsConverting] = useState(false);

  // Price-change warning (old quotation with stale prices)
  const [priceWarningOpen, { open: openPriceWarning, close: closePriceWarning }] = useDisclosure(false);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [isCheckingPrices, setIsCheckingPrices] = useState(false);
  const { taxRate } = useTaxRate();

  // Cache for adjacent quotations
  const quotationCacheRef = useRef<Map<number, QuotationCache>>(new Map());

  // Fetch salesperson name when quotation loads
  useEffect(() => {
    if (!quotation?.salespersonId) { setSalespersonName(null); return; }
    window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: quotation.salespersonId }).then((res) => {
      if (res.success && res.data) {
        const emp = res.data;
        const name = employeeDisplayName(emp);
        setSalespersonName(name);
      }
    });
  }, [quotation?.salespersonId]);

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

  const fromListing = location.state?.fromListing === true;

  // Navigate to previous/next quotation
  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        replaceCurrentTab(`/quotations/${targetId}`, { fromListing: true });
      }
    },
    [replaceCurrentTab]
  );

  // Look up the current inventory price for a line item, using the same
  // retail/wholesale rule used when items are first added to a document.
  const fetchCurrentUnitPrice = useCallback(
    async (item: LineItem, pricing: string): Promise<number | null> => {
      if (!item.sku) return null;
      const applyPricing = (cost: string | null, price: string | null) => {
        const c = parseFloat(cost ?? '0');
        const p = parseFloat(price ?? '0');
        const unit = pricing === 'W' ? c * 1.15 : p;
        return Number.isFinite(unit) ? unit : null;
      };
      if (item.isVariant) {
        const r = await window.electron.invoke(IpcChannel.GET_VARIANT_BY_SKU, { variantSku: item.sku });
        if (!r?.success || !r.data) return null;
        return applyPricing(r.data.cost, r.data.price);
      }
      const r = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku: item.sku });
      if (!r?.success || !r.data) return null;
      return applyPricing(r.data.cost, r.data.price);
    },
    []
  );

  // Compare quoted prices against current inventory prices.
  const detectPriceChanges = useCallback(async (): Promise<PriceChange[]> => {
    if (!quotation) return [];
    const changes: PriceChange[] = [];
    for (const item of lineItems) {
      const current = await fetchCurrentUnitPrice(item, quotation.pricing);
      if (current === null) continue;
      const quoted = parseFloat(item.unitPrice || '0');
      // Compare at cent precision to avoid float noise.
      if (Math.round(current * 100) !== Math.round(quoted * 100)) {
        changes.push({
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          quotedUnitPrice: quoted,
          currentUnitPrice: current,
        });
      }
    }
    return changes;
  }, [quotation, lineItems, fetchCurrentUnitPrice]);

  // Entry point for the "Convert to Invoice" button: check for stale prices
  // first, and route to the price-change warning if any are found.
  const handleOpenConvert = useCallback(async () => {
    if (!quotation) return;
    runWithPermission(
      { permissionCode: 'CONVERT_QUOTATION', actionLabel: `Convert quotation ${quotation.quoteNum}`, context: { entity: 'quotation', id: quotation.id } },
      async () => {
        setIsCheckingPrices(true);
        try {
          const changes = await detectPriceChanges();
          setPriceChanges(changes);
          if (changes.length > 0) {
            openPriceWarning();
          } else {
            openConvertModal();
          }
        } catch (error) {
          console.error('Failed to check prices:', error);
          // On failure, fall back to the plain conversion confirmation.
          setPriceChanges([]);
          openConvertModal();
        } finally {
          setIsCheckingPrices(false);
        }
      }
    );
  }, [quotation, detectPriceChanges, openPriceWarning, openConvertModal, runWithPermission]);

  // Convert quotation to active invoice.
  // Changed line items are always re-priced to the current inventory price and
  // the invoice totals are recalculated; the user is shown all price changes
  // in the warning modal before this runs.
  const handleConvertToInvoice = useCallback(
    async () => {
      if (!quotation) return;

      setIsConverting(true);
      try {
        const priceMap = new Map(priceChanges.map((c) => [c.sku, c.currentUnitPrice]));
        const hasPriceChanges = priceMap.size > 0;

        // Resolve the line items to write, always applying current prices.
        const itemsToWrite = lineItems.map((item) => {
          const newUnit = item.sku ? priceMap.get(item.sku) : undefined;
          if (newUnit !== undefined) {
            const discount = parseFloat(item.discount || '0');
            const amount = item.quantity * newUnit * (1 - discount / 100);
            return { ...item, unitPrice: newUnit.toFixed(2), amount: amount.toFixed(2) };
          }
          return item;
        });

        // Recalculate totals when prices changed; otherwise keep the quote's snapshot.
        let subTotal = quotation.subTotal;
        let tax = quotation.tax;
        let total = quotation.total;
        if (hasPriceChanges) {
          const sub = itemsToWrite.reduce((s, it) => s + parseFloat(it.amount || '0'), 0);
          const taxable = itemsToWrite
            .filter((it) => it.isTaxable)
            .reduce((s, it) => s + parseFloat(it.amount || '0'), 0);
          const taxAmt = quotation.isTaxable ? taxable * taxRate : 0;
          subTotal = sub.toFixed(2);
          tax = taxAmt.toFixed(2);
          total = (sub + taxAmt).toFixed(2);
        }

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
          subTotal,
          tax,
          total,
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
        for (let i = 0; i < itemsToWrite.length; i++) {
          const item = itemsToWrite[i];
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
          message: `Invoice ${newInvoice.invNumber} created from quotation${
            hasPriceChanges ? ' with updated prices' : ''
          }`,
          color: 'green',
        });

        closeConvertModal();
        closePriceWarning();

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
    },
    [quotation, lineItems, priceChanges, taxRate, closeConvertModal, closePriceWarning, replaceCurrentTab]
  );

  // Edit quotation
  const handleEdit = useCallback(() => {
    if (!quotation) return;
    runWithPermission(
      { permissionCode: 'EDIT_QUOTATION', actionLabel: `Edit quotation ${quotation.quoteNum}`, context: { entity: 'quotation', id: quotation.id } },
      () => navigate(`/quotations/${quotation.id}/edit`)
    );
  }, [quotation, navigate, runWithPermission]);

  // Archive quotation
  const handleArchive = useCallback(() => {
    if (!quotation) return;
    runWithPermission(
      { permissionCode: 'ARCHIVE_QUOTATION', actionLabel: `Archive quotation ${quotation.quoteNum}`, context: { entity: 'quotation', id: quotation.id } },
      async () => {
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
      }
    );
  }, [quotation, navigate, runWithPermission]);

  // Mark as expired
  const handleExpire = useCallback(async () => {
    if (!quotation) return;
    runWithPermission(
      { permissionCode: 'ARCHIVE_QUOTATION', actionLabel: `Expire quotation ${quotation.quoteNum}`, context: { entity: 'quotation', id: quotation.id } },
      async () => {
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
      }
    );
  }, [quotation, runWithPermission]);

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
          {fromListing ? (
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => replaceCurrentTab('/quotations')}
              title="Back to Quotations"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
          ) : (
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => replaceCurrentTab('/quotations/new')}
              title="New Quotation"
            >
              <IconPlus size={20} />
            </ActionIcon>
          )}
          <Box style={{ flex: 1 }}>
            <QuotationDetailHeader
              quotation={quotation}
              adjacentIds={fromListing ? adjacentIds : { previousId: null, nextId: null }}
              onNavigateAdjacent={fromListing ? handleNavigateAdjacent : undefined}
              onConvertToInvoice={handleOpenConvert}
              isConvertLoading={isCheckingPrices}
              onEdit={handleEdit}
              onViewClient={handleViewClient}
              onExpire={handleExpire}
              onArchive={handleArchive}
            />
          </Box>
          <LookupTicketButton source="quotation" quotationId={quotation.id} sourceReference={`Quote #${quotation.quoteNum}`} />
          <PrintButton documentType="quotation" documentId={quotation.id} />
        </Group>

        {/* Compact Info Bar */}
        <QuotationDetailInfoBar
          quotation={quotation}
          onViewClient={handleViewClient}
          salespersonName={salespersonName}
          onViewSalesperson={() => quotation.salespersonId && openTab(`/employees/${quotation.salespersonId}`)}
        />

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
              onClick={() => handleConvertToInvoice()}
              loading={isConverting}
            >
              Create Invoice
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Price Change Warning Modal (stale prices on old quotations) */}
      <PriceChangeWarningModal
        opened={priceWarningOpen}
        onClose={closePriceWarning}
        changes={priceChanges}
        quoteNum={quotation.quoteNum}
        onConfirm={() => handleConvertToInvoice()}
        loading={isConverting}
      />
    </>
  );
}
