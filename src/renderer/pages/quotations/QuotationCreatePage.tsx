import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Grid,
  Loader,
  Center,
  ActionIcon,
  Modal,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconKeyboard,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { useKeyboardShortcutContext } from '../../contexts/KeyboardShortcutContext';
import {
  InvoiceFormHeader,
  InvoiceLineItemsTable,
  VariantSelectorModal,
  BulkDiscountModal,
  TargetTotalModal,
  KeyboardShortcutsModal,
  Client,
  InventoryItem,
  LineItem,
  formatCurrency,
} from '../../components/invoices';
import { useVariants } from '../../hooks/useVariants';
import { useTaxRate } from '../../hooks/useTaxRate';

interface LocationState {
  salespersonId?: number;
  salespersonName?: string;
}

export function QuotationCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { markTabDirty, updateTabTitle } = useTabContext();
  const { registerShortcuts, unregisterShortcuts } = useKeyboardShortcutContext();
  const locationState = location.state as LocationState | null;

  const isEditing = !!id;

  // Form state
  const [quoteDate, setQuoteDate] = useState<Date>(new Date());
  const [reference, setReference] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isTaxable, setIsTaxable] = useState(true);
  const [pricing, setPricing] = useState('R'); // R = Retail, W = Wholesale
  const [salespersonId, setSalespersonId] = useState<number | null>(locationState?.salespersonId ?? user?.id ?? null);
  const [salespersonName, setSalespersonName] = useState<string>(locationState?.salespersonName ?? user?.firstName ?? '');
  const [originalQuoteNum, setOriginalQuoteNum] = useState<string | null>(null);

  // Tax rate from system settings
  const { taxRate } = useTaxRate();

  // Selection state for keyboard shortcuts
  const [selectedLineItemId, setSelectedLineItemId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState<{ field: 'quantity' | 'discount' | null; timestamp: number }>({
    field: null,
    timestamp: 0,
  });

  // Search state
  const [clientSearch, setClientSearch] = useState('');
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string; client: Client }[]>([]);
  const [isSearchingClients, setIsSearchingClients] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [itemOptions, setItemOptions] = useState<{ value: string; label: string; item: InventoryItem }[]>([]);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Variant selection
  const [variantModalOpen, { open: openVariantModal, close: closeVariantModal }] = useDisclosure(false);
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null);
  const { variants, isLoading: isLoadingVariants, checkHasVariants, loadVariants, clearVariants } = useVariants();

  // Bulk discount modal
  const [bulkDiscountModalOpen, { open: openBulkDiscountModal, close: closeBulkDiscountModal }] = useDisclosure(false);

  // Target total modal
  const [targetTotalModalOpen, { open: openTargetTotalModal, close: closeTargetTotalModal }] = useDisclosure(false);

  // Keyboard shortcuts help modal
  const [shortcutsModalOpen, { open: openShortcutsModal, close: closeShortcutsModal }] = useDisclosure(false);

  // Delete confirmation modal
  const [deleteConfirmOpen, { open: openDeleteConfirm, close: closeDeleteConfirm }] = useDisclosure(false);
  const [itemToDelete, setItemToDelete] = useState<LineItem | null>(null);

  // Calculate totals
  const totals = useMemo(() => {
    const subTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = lineItems.filter((item) => item.isTaxable).reduce((sum, item) => sum + item.amount, 0);
    const tax = isTaxable ? taxableAmount * taxRate : 0;
    const total = subTotal + tax;
    return { subTotal, tax, total };
  }, [lineItems, isTaxable, taxRate]);

  // Load existing quotation if editing
  useEffect(() => {
    if (isEditing && id) {
      loadQuotation(parseInt(id, 10));
    }
  }, [id, isEditing]);

  // Auto-select first line item when items are added
  useEffect(() => {
    if (lineItems.length > 0 && !selectedLineItemId) {
      setSelectedLineItemId(lineItems[0].id);
    }
  }, [lineItems, selectedLineItemId]);

  // Clear selection if selected item is removed
  useEffect(() => {
    if (selectedLineItemId && !lineItems.find((item) => item.id === selectedLineItemId)) {
      setSelectedLineItemId(lineItems.length > 0 ? lineItems[0].id : null);
    }
  }, [lineItems, selectedLineItemId]);

  const loadQuotation = async (quotationId: number) => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id: quotationId });
      if (result.success && result.data) {
        const quote = result.data;
        setQuoteDate(new Date(quote.quoteDate));
        setReference(quote.reference || '');
        setClientId(quote.clientId);
        setIsTaxable(quote.isTaxable);
        setPricing(quote.pricing);
        setSalespersonId(quote.salespersonId);
        setOriginalQuoteNum(quote.quoteNum);

        // Update tab title
        updateTabTitle(location.pathname, `Edit Quotation ${quote.quoteNum}`);

        // Load client
        if (quote.clientId) {
          const clientResult = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: quote.clientId });
          if (clientResult.success && clientResult.data) {
            setClient(clientResult.data);
            setClientSearch(clientResult.data.clientName);
          }
        }

        // Load line items
        const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_QUOTATION, {
          quoteNum: quote.quoteNum,
        });
        if (itemsResult.success && itemsResult.data) {
          setLineItems(
            itemsResult.data.map((item: any, idx: number) => ({
              id: `existing-${idx}`,
              sku: item.sku || '',
              description: item.description || '',
              quantity: parseFloat(item.quantity) || 0,
              unitPrice: parseFloat(item.unitPrice || '0'),
              discount: parseFloat(item.discount || '0'),
              isTaxable: item.isTaxable,
              amount: parseFloat(item.amount || '0'),
              isVariant: item.isVariant || false,
            }))
          );
        }
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

  // Track dirty state
  useEffect(() => {
    const hasChanges = lineItems.length > 0 || clientId !== null || reference !== '';
    markTabDirty(location.pathname, hasChanges);
  }, [lineItems, clientId, reference, location.pathname, markTabDirty]);

  // Search clients
  const searchClients = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setClientOptions([]);
      return;
    }

    setIsSearchingClients(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_CLIENTS_FOR_SELECT, { query, limit: 10 });
      if (result.success && result.data) {
        setClientOptions(
          result.data.map((c: Client) => ({
            value: c.id.toString(),
            label: `${c.clientName}${c.clNumber ? ` (${c.clNumber})` : ''}`,
            client: c,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to search clients:', error);
    } finally {
      setIsSearchingClients(false);
    }
  }, 300);

  // Search inventory items
  const searchItems = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setItemOptions([]);
      return;
    }

    setIsSearchingItems(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_INVENTORY_FOR_SELECT, { query, limit: 15 });
      if (result.success && result.data) {
        setItemOptions(
          result.data.map((item: InventoryItem) => ({
            value: item.sku,
            label: `${item.sku} - ${item.description1 || 'No description'}`,
            item,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to search items:', error);
    } finally {
      setIsSearchingItems(false);
    }
  }, 300);

  // Handle client selection
  const handleClientSelect = useCallback(
    (value: string) => {
      const option = clientOptions.find((o) => o.value === value);
      if (option) {
        setClient(option.client);
        setClientId(option.client.id);
        setClientSearch(option.client.clientName);
        setIsTaxable(option.client.isTaxable);
      }
    },
    [clientOptions]
  );

  // Add line item from inventory item
  const addLineItemFromInventory = useCallback(
    (item: InventoryItem, sku?: string, description?: string, isVariant: boolean = false) => {
      const unitPrice = pricing === 'W' ? parseFloat(item.cost || '0') * 1.15 : parseFloat(item.price || '0');

      const newLineItem: LineItem = {
        id: `new-${Date.now()}`,
        sku: sku || item.sku,
        description: description || item.description1 || '',
        quantity: 1,
        unitPrice,
        discount: 0,
        isTaxable: item.isTaxable,
        amount: unitPrice,
        inventoryId: item.id,
        isVariant,
      };

      setLineItems((prev) => [...prev, newLineItem]);
      setItemSearch('');
      setItemOptions([]);
    },
    [pricing]
  );

  // Handle variant selection
  const handleVariantSelect = useCallback(
    (variant: any) => {
      if (pendingItem) {
        const variantPrice = variant.price ? parseFloat(variant.price) : null;
        const useVariantPrice = variantPrice !== null && variantPrice > 0;
        const itemForPricing = useVariantPrice
          ? { ...pendingItem, price: variant.price, cost: variant.cost || pendingItem.cost }
          : pendingItem;
        addLineItemFromInventory(itemForPricing, variant.variantSku, variant.variantName || variant.description, true);
        setPendingItem(null);
        clearVariants();
      }
    },
    [pendingItem, addLineItemFromInventory, clearVariants]
  );

  // Handle item selection
  const handleItemSelect = useCallback(
    async (value: string) => {
      const option = itemOptions.find((o) => o.value === value);
      if (option) {
        const item = option.item;
        const hasVariants = await checkHasVariants(item.sku);

        if (hasVariants) {
          setPendingItem(item);
          await loadVariants(item.sku);
          openVariantModal();
        } else {
          addLineItemFromInventory(item);
        }
      }
    },
    [itemOptions, checkHasVariants, loadVariants, addLineItemFromInventory, openVariantModal]
  );

  // Update line item
  const updateLineItem = useCallback((itemId: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        if (field === 'quantity' || field === 'unitPrice' || field === 'discount') {
          const qty = field === 'quantity' ? value : item.quantity;
          const price = field === 'unitPrice' ? value : item.unitPrice;
          const disc = field === 'discount' ? value : item.discount;
          updated.amount = qty * price * (1 - disc / 100);
        }

        return updated;
      })
    );
  }, []);

  // Remove line item
  const removeLineItem = useCallback((itemId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  // Selection helper functions
  const selectLineItem = useCallback((itemId: string | null) => {
    setSelectedLineItemId(itemId);
  }, []);

  const selectNextLineItem = useCallback(() => {
    if (lineItems.length === 0) return;
    const currentIndex = lineItems.findIndex((item) => item.id === selectedLineItemId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % lineItems.length;
    setSelectedLineItemId(lineItems[nextIndex].id);
  }, [lineItems, selectedLineItemId]);

  const selectPreviousLineItem = useCallback(() => {
    if (lineItems.length === 0) return;
    const currentIndex = lineItems.findIndex((item) => item.id === selectedLineItemId);
    const prevIndex = currentIndex === -1 ? lineItems.length - 1 : (currentIndex - 1 + lineItems.length) % lineItems.length;
    setSelectedLineItemId(lineItems[prevIndex].id);
  }, [lineItems, selectedLineItemId]);

  // Apply bulk discount
  const handleApplyBulkDiscount = useCallback((discountPercent: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        const updated = { ...item, discount: discountPercent };
        updated.amount = item.quantity * item.unitPrice * (1 - discountPercent / 100);
        return updated;
      })
    );
    notifications.show({
      title: 'Discount Applied',
      message: `${discountPercent}% discount applied to all line items`,
      color: 'green',
    });
  }, []);

  // Save quotation
  const handleSave = useCallback(async () => {
    if (lineItems.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please add at least one line item',
        color: 'red',
      });
      return;
    }

    setIsSaving(true);
    try {
      const quotationData = {
        quoteDate: quoteDate.toISOString().split('T')[0],
        salespersonId,
        clientId,
        clientName: client?.clientName || null,
        clientAddress1: client?.address1 || null,
        clientAddress2: client?.address2 || null,
        clientPhone: client?.phone || null,
        reference: reference || null,
        subTotal: totals.subTotal.toFixed(2),
        tax: totals.tax.toFixed(2),
        total: totals.total.toFixed(2),
        isTaxable,
        pricing,
      };

      let quotationId: number;
      let quoteNum: string;

      if (isEditing && id && originalQuoteNum) {
        // Delete existing line items first
        await window.electron.invoke(IpcChannel.DELETE_DOCUMENT_LINE_ITEMS_BY_DOCUMENT, {
          documentType: 'QUOTE',
          documentNumber: originalQuoteNum,
        });

        const result = await window.electron.invoke(IpcChannel.UPDATE_QUOTATION, {
          id: parseInt(id, 10),
          data: quotationData,
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update quotation');
        }
        quotationId = parseInt(id, 10);
        quoteNum = result.data.quoteNum;
      } else {
        const result = await window.electron.invoke(IpcChannel.CREATE_QUOTATION, quotationData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create quotation');
        }
        quotationId = result.data.id;
        quoteNum = result.data.quoteNum;
      }

      // Save line items
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
          documentType: 'QUOTE',
          documentNumber: quoteNum,
          lineNumber: i + 1,
          sku: item.sku || null,
          isVariant: item.isVariant || false,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toFixed(2),
          discount: item.discount.toFixed(2),
          isTaxable: item.isTaxable,
          amount: item.amount.toFixed(2),
        });
      }

      notifications.show({
        title: 'Success',
        message: `Quotation ${quoteNum} saved successfully`,
        color: 'green',
      });

      navigate(`/quotations/${quotationId}`);
    } catch (error) {
      console.error('Failed to save quotation:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save quotation',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isEditing,
    id,
    originalQuoteNum,
    quoteDate,
    salespersonId,
    clientId,
    client,
    reference,
    totals,
    isTaxable,
    pricing,
    lineItems,
    navigate,
  ]);

  // Register keyboard shortcuts
  useEffect(() => {
    const shortcuts = [
      {
        key: 'q',
        ctrl: true,
        callback: () => {
          if (selectedLineItemId) {
            setFocusTrigger({ field: 'quantity', timestamp: Date.now() });
          }
        },
        description: 'Focus quantity field of selected line item',
      },
      {
        key: 'd',
        ctrl: true,
        shift: true,
        callback: () => {
          if (selectedLineItemId) {
            setFocusTrigger({ field: 'discount', timestamp: Date.now() });
          }
        },
        description: 'Focus discount field of selected line item',
      },
      {
        key: 'Delete',
        callback: () => {
          if (!selectedLineItemId) return;
          const item = lineItems.find((item) => item.id === selectedLineItemId);
          if (!item) return;
          setItemToDelete(item);
          openDeleteConfirm();
        },
        description: 'Delete selected line item',
      },
      {
        key: 'd',
        ctrl: true,
        alt: true,
        callback: () => {
          if (lineItems.length === 0) {
            notifications.show({
              title: 'No Line Items',
              message: 'Add line items before applying bulk discount',
              color: 'orange',
            });
            return;
          }
          openBulkDiscountModal();
        },
        description: 'Apply bulk discount to all line items',
      },
      {
        key: 't',
        ctrl: true,
        callback: () => {
          if (lineItems.length === 0) {
            notifications.show({
              title: 'No Line Items',
              message: 'Add line items before calculating target total',
              color: 'orange',
            });
            return;
          }
          openTargetTotalModal();
        },
        description: 'Calculate discount for target total',
      },
      {
        key: 's',
        ctrl: true,
        callback: () => {
          handleSave();
        },
        description: 'Save quotation',
      },
      {
        key: 'ArrowUp',
        callback: () => {
          selectPreviousLineItem();
        },
        description: 'Select previous line item',
      },
      {
        key: 'ArrowDown',
        callback: () => {
          selectNextLineItem();
        },
        description: 'Select next line item',
      },
    ];

    registerShortcuts('quotation-line-items', shortcuts);

    return () => {
      unregisterShortcuts('quotation-line-items');
    };
  }, [selectedLineItemId, lineItems, openBulkDiscountModal, openTargetTotalModal, handleSave, selectPreviousLineItem, selectNextLineItem, registerShortcuts, unregisterShortcuts]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <ActionIcon variant="subtle" size="lg" onClick={() => navigate('/quotations')}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Stack gap={4}>
              <Title order={2}>{isEditing ? 'Edit Quotation' : 'New Quotation'}</Title>
              {salespersonName && (
                <Text c="dimmed" size="sm">
                  Salesperson: {salespersonName}
                </Text>
              )}
            </Stack>
          </Group>

          <Group gap="sm">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={openShortcutsModal}
              title="Keyboard Shortcuts"
            >
              <IconKeyboard size={20} />
            </ActionIcon>
            <Button
              color="violet"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={lineItems.length === 0}
            >
              Save Quotation
            </Button>
          </Group>
        </Group>

        <Grid>
          {/* Quotation Details */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <InvoiceFormHeader
              invDate={quoteDate}
              setInvDate={setQuoteDate}
              reference={reference}
              setReference={setReference}
              client={client}
              clientSearch={clientSearch}
              setClientSearch={setClientSearch}
              clientOptions={clientOptions}
              isSearchingClients={isSearchingClients}
              onClientSearchChange={searchClients}
              onClientSelect={handleClientSelect}
              pricing={pricing}
              setPricing={setPricing}
              creditTerms=""
              setCreditTerms={() => {}}
              isTaxable={isTaxable}
              setIsTaxable={setIsTaxable}
            />

            {/* Line Items */}
            <InvoiceLineItemsTable
              lineItems={lineItems}
              itemSearch={itemSearch}
              setItemSearch={setItemSearch}
              itemOptions={itemOptions}
              isSearchingItems={isSearchingItems}
              onItemSearchChange={searchItems}
              onItemSelect={handleItemSelect}
              onUpdateLineItem={updateLineItem}
              onRemoveLineItem={removeLineItem}
              formatCurrency={formatCurrency}
              inventoryWarnings={[]}
              isCheckingInventory={false}
              selectedLineItemId={selectedLineItemId}
              onSelectLineItem={selectLineItem}
              focusTrigger={focusTrigger}
            />
          </Grid.Col>

          {/* Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <QuotationSummaryCard
              lineItemCount={lineItems.length}
              totals={totals}
              isTaxable={isTaxable}
              taxRate={taxRate}
              isSaving={isSaving}
              hasLineItems={lineItems.length > 0}
              formatCurrency={formatCurrency}
              onSave={handleSave}
            />
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Variant Selector Modal */}
      <VariantSelectorModal
        opened={variantModalOpen}
        onClose={() => {
          closeVariantModal();
          setPendingItem(null);
          clearVariants();
        }}
        parentSku={pendingItem?.sku || ''}
        variants={variants}
        isLoading={isLoadingVariants}
        onSelectVariant={handleVariantSelect}
      />

      {/* Bulk Discount Modal */}
      <BulkDiscountModal
        opened={bulkDiscountModalOpen}
        onClose={closeBulkDiscountModal}
        onApply={handleApplyBulkDiscount}
      />

      {/* Target Total Modal */}
      <TargetTotalModal
        opened={targetTotalModalOpen}
        onClose={closeTargetTotalModal}
        onApply={handleApplyBulkDiscount}
        currentSubTotal={totals.subTotal}
        taxRate={taxRate}
        isTaxable={isTaxable}
        formatCurrency={formatCurrency}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal opened={shortcutsModalOpen} onClose={closeShortcutsModal} />

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteConfirmOpen}
        onClose={closeDeleteConfirm}
        title="Delete Line Item"
        centered
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to delete "{itemToDelete?.description || itemToDelete?.sku}"?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeDeleteConfirm}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={() => {
                if (itemToDelete) {
                  removeLineItem(itemToDelete.id);
                  closeDeleteConfirm();
                  setItemToDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

// Quotation Summary Card Component
interface QuotationSummaryCardProps {
  lineItemCount: number;
  totals: { subTotal: number; tax: number; total: number };
  isTaxable: boolean;
  taxRate: number;
  isSaving: boolean;
  hasLineItems: boolean;
  formatCurrency: (value: number) => string;
  onSave: () => void;
}

function QuotationSummaryCard({
  lineItemCount,
  totals,
  isTaxable,
  taxRate,
  isSaving,
  hasLineItems,
  formatCurrency,
  onSave,
}: QuotationSummaryCardProps) {
  return (
    <Stack
      gap="md"
      p="lg"
      style={{
        backgroundColor: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        position: 'sticky',
        top: 20,
      }}
    >
      <Text fw={600} size="lg">
        Quotation Summary
      </Text>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            Items
          </Text>
          <Text size="sm">{lineItemCount}</Text>
        </Group>

        <Group justify="space-between">
          <Text c="dimmed" size="sm">
            Subtotal
          </Text>
          <Text size="sm">{formatCurrency(totals.subTotal)}</Text>
        </Group>

        {isTaxable && (
          <Group justify="space-between">
            <Text c="dimmed" size="sm">
              Tax ({(taxRate * 100).toFixed(0)}%)
            </Text>
            <Text size="sm">{formatCurrency(totals.tax)}</Text>
          </Group>
        )}

        <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Text fw={600}>Total</Text>
          <Text fw={600} size="lg">
            {formatCurrency(totals.total)}
          </Text>
        </Group>
      </Stack>

      <Button
        color="violet"
        fullWidth
        size="md"
        leftSection={<IconDeviceFloppy size={18} />}
        onClick={onSave}
        loading={isSaving}
        disabled={!hasLineItems}
      >
        Save Quotation
      </Button>
    </Stack>
  );
}
