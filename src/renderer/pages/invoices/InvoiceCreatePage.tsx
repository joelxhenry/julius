import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { Box, Stack, Loader, Center, Modal, Text, Group, Button, Paper, Badge, ScrollArea, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';
import { PinVerificationModal } from '../../components/auth/PinVerificationModal';
import {
  AdminOverrideModal,
  CompactInvoiceToolbar,
  CompactFormBar,
  InvoiceLineItemsTable,
  VariantSelectorModal,
  BulkDiscountModal,
  TargetTotalModal,
  KeyboardShortcutsModal,
  PaymentEntryModal,
  FloatingAlerts,
  InventoryItem,
  CreditCheckResult,
  AdminOverrideResult,
  PaymentEntry,
  formatCurrency,
} from '../../components/invoices';
import { useInventoryCheck } from '../../hooks/useInventoryCheck';
import { useVariants } from '../../hooks/useVariants';
import { useTaxRate } from '../../hooks/useTaxRate';
import {
  useClientSearch,
  useInventorySearch,
  useLineItems,
  useInvoiceForm,
  useInvoiceKeyboardShortcuts,
} from '../../hooks';
import { useTrayDraftIntegration } from '../../hooks/useTrayDraftIntegration';
import { useTabPath } from '../../components/layout/TabContainer';

interface LocationState {
  salespersonId?: number;
  salespersonName?: string;
}

export function InvoiceCreatePage() {
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { markTabDirty, updateTabTitle, replaceCurrentTab } = useTabContext();
  const tabPath = useTabPath();
  // Owning-tab path: prefer the tab the page is mounted in (stable across active-tab
  // switches) and only fall back to the live URL when not rendered inside a tab.
  const ownPath = tabPath ?? location.pathname;
  const locationState = location.state as LocationState | null;

  const isEditing = !!id && /^\d+$/.test(id);

  // Debug logging
  useEffect(() => {
    console.log('[InvoiceCreatePage] id:', id, 'isEditing:', isEditing, 'location:', location.pathname);
  }, [id, isEditing, location.pathname]);

  // Tax rate from system settings
  const { taxRate } = useTaxRate();

  // Form state hook
  const [formState, formActions] = useInvoiceForm({ locationState });

  // Line items hook
  const {
    items: lineItems,
    selectedId: selectedLineItemId,
    totals,
    editingCell,
    setSelectedId: setSelectedLineItemId,
    addItem: addLineItem,
    updateItem: updateLineItem,
    removeItem: removeLineItem,
    applyBulkDiscount,
    selectNext: selectNextLineItem,
    selectPrevious: selectPreviousLineItem,
    setItems: setLineItems,
    startEditing,
    stopEditing,
  } = useLineItems({ taxRate, isTaxable: formState.isTaxable });

  // Refs for auto-focus
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const inventorySearchRef = useRef<HTMLInputElement>(null);
  const pricingSelectRef = useRef<HTMLInputElement>(null);

  // Credit check
  const [creditCheck, setCreditCheck] = useState<CreditCheckResult | null>(null);

  // Loading/saving state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Marked-items tray integration: prefill on `state.fromTray`, register draft handler.
  useTrayDraftIntegration({
    docType: 'invoice',
    enabled: !isEditing && !isLoading,
    pricing: formState.pricing,
    addItem: (data) =>
      addLineItem({
        sku: data.sku,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        discount: 0,
        isTaxable: data.isTaxable,
        inventoryId: data.inventoryId,
        isVariant: data.isVariant,
      }),
  });

  // Recent invoices for quick access
  const [recentInvoices, setRecentInvoices] = useState<Array<{
    id: number;
    invNumber: string;
    clientName: string | null;
    status: string;
  }>>([]);

  // Fetch recent active invoices on mount
  useEffect(() => {
    const fetchRecentInvoices = async () => {
      try {
        // Get the limit from system settings
        let limit = 8;
        const settingResult = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
          key: 'recent_invoices_limit',
        });
        if (settingResult.success && settingResult.data?.value !== null) {
          limit = parseInt(settingResult.data.value, 10) || 8;
        }

        // If limit is 0, don't fetch invoices
        if (limit === 0) {
          setRecentInvoices([]);
          return;
        }

        const result = await window.electron.invoke(IpcChannel.GET_RECENT_INVOICES, { limit: limit + 5 });
        if (result.success && result.data) {
          // Filter to show only active/pending invoices
          const activeInvoices = result.data.filter(
            (inv: any) => inv.status === 'active' || inv.status === 'pending'
          );
          setRecentInvoices(activeInvoices.slice(0, limit));
        }
      } catch (error) {
        console.error('Failed to fetch recent invoices:', error);
      }
    };
    fetchRecentInvoices();
  }, []);

  // Check client credit
  const checkClientCredit = useCallback(async (checkClientId: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CHECK_CLIENT_CREDIT, { clientId: checkClientId });
      if (result.success && result.data) {
        setCreditCheck(result.data);
      }
    } catch (error) {
      console.error('Failed to check client credit:', error);
    }
  }, []);

  // Client search hook
  const {
    search: clientSearch,
    setSearch: setClientSearch,
    options: clientOptions,
    isSearching: isSearchingClients,
    selectedClient: client,
    searchClients,
    handleSelect: handleClientSelectInternal,
    setClient,
  } = useClientSearch({
    onSelect: (selectedClient) => {
      formActions.setClientId(selectedClient.id);
      formActions.setIsTaxable(selectedClient.isTaxable);
      formActions.setCreditTerms(selectedClient.creditTerms || '');
      checkClientCredit(selectedClient.id);
      setTimeout(() => {
        pricingSelectRef.current?.focus();
      }, 100);
    },
  });

  // Inventory search hook
  const {
    search: itemSearch,
    setSearch: setItemSearch,
    options: itemOptions,
    isSearching: isSearchingItems,
    searchItems,
    clearSearch: clearItemSearch,
  } = useInventorySearch();

  // Modals
  const [overrideModalOpen, { open: openOverrideModal, close: closeOverrideModal }] = useDisclosure(false);
  const [issueModalOpen, { open: openIssueModal, close: closeIssueModal }] = useDisclosure(false);
  const [paymentEntryModalOpen, { open: openPaymentEntryModal, close: closePaymentEntryModal }] = useDisclosure(false);
  const [isPaymentFlow, setIsPaymentFlow] = useState(false);
  const [adminOverride, setAdminOverride] = useState<AdminOverrideResult | undefined>(undefined);

  // Variant selection
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<InventoryItem | null>(null);
  const { variants, isLoading: isLoadingVariants, checkHasVariants, loadVariants, clearVariants } = useVariants();

  // Inventory check hook
  const { inventoryWarnings, isChecking: isCheckingInventory } = useInventoryCheck(
    lineItems.map(item => ({ sku: item.sku, quantity: item.quantity }))
  );

  // Issue invoice handler
  const handleIssueInvoice = useCallback(() => {
    if (creditCheck?.requiresAdminOverride) {
      openOverrideModal();
      return;
    }
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Save & pay handler
  const handleSaveAndProcessPayment = useCallback(() => {
    if (creditCheck?.requiresAdminOverride) {
      setIsPaymentFlow(true);
      openOverrideModal();
      return;
    }
    setIsPaymentFlow(true);
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Keyboard shortcuts hook
  const shortcutsHook = useInvoiceKeyboardShortcuts({
    lineItems,
    selectedLineItemId,
    selectNextLineItem,
    selectPreviousLineItem,
    onIssueInvoice: handleIssueInvoice,
    onSaveAndPay: handleSaveAndProcessPayment,
    onStartEditing: startEditing,
    onStopEditing: stopEditing,
    editingCell,
  });

  // Load existing invoice if editing
  useEffect(() => {
    if (isEditing && id) {
      loadInvoice(parseInt(id, 10));
    }
  }, [id, isEditing]);

  const loadInvoice = async (invoiceId: number) => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoiceId });
      if (result.success && result.data) {
        const inv = result.data;
        formActions.loadFromInvoice(inv);

        if (ownPath === `/invoices/form/${id}` || ownPath === `/invoices/edit/${id}`) {
          updateTabTitle(ownPath, `Edit Invoice ${inv.invNumber}`);
        }

        if (inv.clientId) {
          const clientResult = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: inv.clientId });
          if (clientResult.success && clientResult.data) {
            setClient(clientResult.data);
            setClientSearch(clientResult.data.clientName);
          }
        }

        const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_INVOICE, {
          invNumber: inv.invNumber,
        });
        if (itemsResult.success && itemsResult.data) {
          setLineItems(
            itemsResult.data.map((item: any, idx: number) => ({
              id: `existing-${idx}`,
              sku: item.sku || '',
              description: item.description || '',
              quantity: item.quantity,
              unitPrice: parseFloat(item.unitPrice || '0'),
              discount: parseFloat(item.discount || '0'),
              isTaxable: item.isTaxable,
              amount: parseFloat(item.amount || '0'),
            }))
          );
        }
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

  // Track dirty state — must target the OWNING tab's path. `location.pathname` here
  // returns the *active* tab's URL (this page can be mounted but not active inside
  // TabContainer), so using it would mark a sibling tab dirty.
  useEffect(() => {
    const hasChanges = lineItems.length > 0 || formState.clientId !== null || formState.reference !== '';
    markTabDirty(ownPath, hasChanges);
  }, [lineItems, formState.clientId, formState.reference, ownPath, markTabDirty]);

  // Add line item from inventory
  const addLineItemFromInventory = useCallback(
    (item: InventoryItem, sku?: string, description?: string, isVariant = false) => {
      const unitPrice = formState.pricing === 'W' ? parseFloat(item.cost || '0') * 1.15 : parseFloat(item.price || '0');

      addLineItem({
        sku: sku || item.sku,
        description: description || item.description1 || '',
        quantity: 1,
        unitPrice,
        discount: 0,
        isTaxable: item.isTaxable,
        inventoryId: item.id,
        isVariant,
      });
      clearItemSearch();

      setTimeout(() => {
        inventorySearchRef.current?.focus();
      }, 100);
    },
    [formState.pricing, addLineItem, clearItemSearch]
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

        // If the item is already a variant (from unified search), add it directly
        if ((item as any).isVariant) {
          addLineItemFromInventory(item, item.sku, (item as any).variantName || item.description1 || '', true);
          return;
        }

        // Otherwise check if inventory item has variants
        const hasVariants = await checkHasVariants(item.sku);

        if (hasVariants) {
          setPendingItem(item);
          await loadVariants(item.sku);
          setVariantModalOpen(true);
        } else {
          addLineItemFromInventory(item);
        }
      }
    },
    [itemOptions, checkHasVariants, loadVariants, addLineItemFromInventory]
  );

  // Apply bulk discount
  const handleApplyBulkDiscount = useCallback((discountPercent: number) => {
    applyBulkDiscount(discountPercent);
    notifications.show({
      title: 'Discount Applied',
      message: `${discountPercent}% discount applied to all line items`,
      color: 'green',
    });
  }, [applyBulkDiscount]);

  // Show payment entry modal
  const handleShowPaymentEntry = useCallback(
    (override?: AdminOverrideResult) => {
      if (lineItems.length === 0) {
        notifications.show({
          title: 'Error',
          message: 'Please add at least one line item',
          color: 'red',
        });
        return;
      }
      setAdminOverride(override);
      openPaymentEntryModal();
    },
    [lineItems, openPaymentEntryModal]
  );

  // Create invoice with payment
  const handleCreateInvoiceWithPayment = useCallback(
    async (paymentEntries: PaymentEntry[]) => {
      setIsSaving(true);
      try {
        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_WITH_PAYMENT, {
          invoiceData: {
            invDate: formState.invDate.toISOString().split('T')[0],
            salespersonId: formState.salespersonId,
            clientId: formState.clientId,
            clientName: client?.clientName || null,
            clientAddress1: client?.address1 || null,
            clientAddress2: client?.address2 || null,
            clientPhone: client?.phone || null,
            reference: formState.reference || null,
            notes: formState.notes || null,
            subTotal: totals.subTotal.toFixed(2),
            tax: totals.tax.toFixed(2),
            total: totals.total.toFixed(2),
            isTaxable: formState.isTaxable,
            pricing: formState.pricing,
            creditTerms: formState.creditTerms || null,
            issuedAt: new Date(),
            issuedById: formState.salespersonId,
            ...(adminOverride && {
              adminOverrideById: adminOverride.adminId,
              adminOverrideNotes: adminOverride.notes,
              adminOverrideAt: new Date(),
            }),
          },
          lineItems: lineItems.map((item, i) => ({
            lineNumber: i + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            isTaxable: item.isTaxable,
            amount: item.amount.toFixed(2),
          })),
          paymentEntries,
          processedById: formState.salespersonId!,
          payerName: client?.clientName || 'Cash Customer',
        });

        if (result.success) {
          const { invoice, warnings } = result.data;
          notifications.show({
            title: 'Success',
            message: `Invoice ${invoice.invNumber} created and ${invoice.status === 'paid' ? 'paid' : 'partially paid'}`,
            color: 'green',
          });
          if (warnings.length > 0) {
            warnings.forEach((w: string) => notifications.show({ message: w, color: 'yellow' }));
          }
          replaceCurrentTab(`/invoices/${invoice.id}`);
        } else {
          notifications.show({ title: 'Error', message: result.error, color: 'red' });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to create invoice',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
        closePaymentEntryModal();
      }
    },
    [formState, client, totals, lineItems, replaceCurrentTab, closePaymentEntryModal, adminOverride]
  );

  // Issue invoice after verification
  const handleIssueVerified = useCallback(
    async (override?: AdminOverrideResult) => {
      // Editing an existing invoice down to zero line items cancels it.
      // Creating a new invoice still requires at least one line item.
      const isCancelling =
        isEditing && !!id && !!formState.originalInvNumber && lineItems.length === 0;

      if (lineItems.length === 0 && !isCancelling) {
        notifications.show({ title: 'Error', message: 'Please add at least one line item', color: 'red' });
        return;
      }

      const proceed = async () => {
      setIsSaving(true);
      try {
        let invoiceId: number;
        let invNumber: string;

        if (isEditing && id && formState.originalInvNumber) {
          // Update existing invoice
          const updateData = {
            invDate: formState.invDate.toISOString().split('T')[0],
            salespersonId: formState.salespersonId,
            clientId: formState.clientId,
            clientName: client?.clientName || null,
            clientAddress1: client?.address1 || null,
            clientAddress2: client?.address2 || null,
            clientPhone: client?.phone || null,
            reference: formState.reference || null,
            notes: formState.notes || null,
            subTotal: totals.subTotal.toFixed(2),
            tax: totals.tax.toFixed(2),
            total: totals.total.toFixed(2),
            isTaxable: formState.isTaxable,
            pricing: formState.pricing,
            creditTerms: formState.creditTerms || null,
            // Zero line items on edit cancels the invoice; otherwise status is preserved.
            ...(isCancelling && { status: 'cancelled' }),
            ...(override && {
              adminOverrideById: override.adminId,
              adminOverrideNotes: override.notes,
              adminOverrideAt: new Date(),
            }),
          };

          // Delete existing line items
          await window.electron.invoke(IpcChannel.DELETE_DOCUMENT_LINE_ITEMS_BY_DOCUMENT, {
            documentType: 'INVOICE',
            documentNumber: formState.originalInvNumber,
          });

          const result = await window.electron.invoke(IpcChannel.UPDATE_INVOICE, {
            id: parseInt(id, 10),
            data: updateData,
          });
          if (!result.success) throw new Error(result.error || 'Failed to update invoice');

          invoiceId = parseInt(id, 10);
          invNumber = result.data.invNumber;
        } else {
          // Create new invoice
          const invoiceData = {
            invDate: formState.invDate.toISOString().split('T')[0],
            salespersonId: formState.salespersonId,
            clientId: formState.clientId,
            clientName: client?.clientName || null,
            clientAddress1: client?.address1 || null,
            clientAddress2: client?.address2 || null,
            clientPhone: client?.phone || null,
            reference: formState.reference || null,
            notes: formState.notes || null,
            subTotal: totals.subTotal.toFixed(2),
            tax: totals.tax.toFixed(2),
            total: totals.total.toFixed(2),
            totalPaid: '0',
            status: 'active',
            isTaxable: formState.isTaxable,
            pricing: formState.pricing,
            creditTerms: formState.creditTerms || null,
            issuedAt: new Date(),
            issuedById: formState.salespersonId,
            ...(override && {
              adminOverrideById: override.adminId,
              adminOverrideNotes: override.notes,
              adminOverrideAt: new Date(),
            }),
          };

          const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
          if (!result.success) throw new Error(result.error || 'Failed to create invoice');

          invoiceId = result.data.id;
          invNumber = result.data.invNumber;
        }

        // Save line items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
            documentType: 'INVOICE',
            documentNumber: invNumber,
            lineNumber: i + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            isTaxable: item.isTaxable,
            amount: item.amount.toFixed(2),
          });
        }

        // Create inventory transactions (only for new invoices)
        if (!isEditing) {
          const transactionResult = await window.electron.invoke(IpcChannel.CREATE_INVOICE_TRANSACTIONS, {
            invNumber,
            lineItems: lineItems.map(item => ({ sku: item.sku, quantity: item.quantity })),
            invDate: formState.invDate.toISOString().split('T')[0],
          });

          if (!transactionResult.success) {
            console.error('Warning: Failed to create inventory transactions:', transactionResult.error);
            notifications.show({ title: 'Warning', message: 'Invoice created but inventory may not have been updated', color: 'yellow' });
          }
        }

        notifications.show({
          title: isCancelling ? 'Invoice Cancelled' : 'Success',
          message: isCancelling
            ? `Invoice ${invNumber} has been cancelled`
            : `Invoice ${invNumber} ${isEditing ? 'updated' : 'created and issued'}`,
          color: isCancelling ? 'orange' : 'green',
        });
        replaceCurrentTab(`/invoices/${invoiceId}`);
      } catch (error) {
        console.error('Failed to issue invoice:', error);
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to issue invoice',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
      }
      };

      if (isCancelling) {
        modals.openConfirmModal({
          title: 'Cancel Invoice',
          children: (
            <Text size="sm">
              This invoice has no line items. Saving will mark invoice{' '}
              <strong>{formState.originalInvNumber}</strong> as <strong>Cancelled</strong>.
              This action cannot be undone.
            </Text>
          ),
          labels: { confirm: 'Cancel Invoice', cancel: 'Keep Editing' },
          confirmProps: { color: 'red' },
          onConfirm: () => { void proceed(); },
        });
        return;
      }

      await proceed();
    },
    [formState, client, totals, lineItems, replaceCurrentTab, isEditing, id]
  );

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <>
      <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 8, overflow: 'auto' }}>
        {/* Recent Active Invoices */}
        {recentInvoices.length > 0 && (
          <Paper px="md" py="sm" withBorder radius="md" style={{ flexShrink: 0 }}>
            <Group gap="md">
              <Text size="sm" fw={600} c="dimmed">Latest Invoices:</Text>
              <ScrollArea type="never" style={{ flex: 1 }}>
                <Group gap="sm" wrap="nowrap">
                  {recentInvoices.map((inv) => (
                    <UnstyledButton
                      key={inv.id}
                      onClick={() => replaceCurrentTab(`/invoices/${inv.id}`)}
                      style={{ flexShrink: 0 }}
                    >
                      <Paper
                        px="md"
                        py="xs"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          backgroundColor: 'var(--mantine-color-blue-light)',
                        }}
                      >
                        <Group gap="xs" wrap="nowrap">
                          <Text size="sm" fw={600} c="blue">
                            {inv.invNumber}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {inv.clientName || 'No Client'}
                          </Text>
                        </Group>
                      </Paper>
                    </UnstyledButton>
                  ))}
                </Group>
              </ScrollArea>
            </Group>
          </Paper>
        )}

        {/* Compact Toolbar with Actions and Totals */}
        <CompactInvoiceToolbar
          isEditing={isEditing}
          originalInvNumber={formState.originalInvNumber}
          totals={totals}
          isTaxable={formState.isTaxable}
          isSaving={isSaving}
          hasLineItems={lineItems.length > 0}
          onOpenShortcuts={shortcutsHook.openShortcutsModal}
          onIssueInvoice={handleIssueInvoice}
          onSaveAndPay={handleSaveAndProcessPayment}
        />

        {/* Compact Form Bar */}
        <CompactFormBar
          invDate={formState.invDate}
          setInvDate={formActions.setInvDate}
          reference={formState.reference}
          setReference={formActions.setReference}
          client={client}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          clientOptions={clientOptions}
          isSearchingClients={isSearchingClients}
          onClientSearchChange={searchClients}
          onClientSelect={handleClientSelectInternal}
          pricing={formState.pricing}
          setPricing={formActions.setPricing}
          creditTerms={formState.creditTerms}
          setCreditTerms={formActions.setCreditTerms}
          isTaxable={formState.isTaxable}
          setIsTaxable={formActions.setIsTaxable}
          taxRate={taxRate}
          notes={formState.notes}
          setNotes={formActions.setNotes}
          referenceInputRef={referenceInputRef}
          pricingSelectRef={pricingSelectRef}
        />

        {/* Line Items - Primary Focus */}
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
          inventoryWarnings={inventoryWarnings}
          isCheckingInventory={isCheckingInventory}
          selectedLineItemId={selectedLineItemId}
          onSelectLineItem={setSelectedLineItemId}
          focusTrigger={shortcutsHook.focusTrigger}
          inventorySearchRef={inventorySearchRef}
          editingCell={editingCell}
          onStartEditing={startEditing}
          onStopEditing={stopEditing}
        />
      </Box>

      {/* Admin Override Modal */}
      {creditCheck && (
        <AdminOverrideModal
          opened={overrideModalOpen}
          onClose={() => { closeOverrideModal(); setIsPaymentFlow(false); }}
          onApproved={(result) => {
            closeOverrideModal();
            if (isPaymentFlow) {
              handleShowPaymentEntry(result);
              setIsPaymentFlow(false);
            } else {
              handleIssueVerified(result);
            }
          }}
          clientName={client?.clientName || 'Unknown Client'}
          creditIssues={creditCheck.reasons}
        />
      )}

      {/* Issue Verification Modal */}
      <PinVerificationModal
        opened={issueModalOpen}
        onClose={() => { closeIssueModal(); setIsPaymentFlow(false); }}
        onVerified={() => {
          closeIssueModal();
          if (isPaymentFlow) {
            handleShowPaymentEntry();
            setIsPaymentFlow(false);
          } else {
            handleIssueVerified();
          }
        }}
        title="Issue Invoice"
        description="Verify your access code to issue this invoice."
        requiredPermission="CREATE_INVOICE"
      />

      {/* Variant Selector Modal */}
      <VariantSelectorModal
        opened={variantModalOpen}
        onClose={() => { setVariantModalOpen(false); setPendingItem(null); clearVariants(); }}
        parentSku={pendingItem?.sku || ''}
        variants={variants}
        isLoading={isLoadingVariants}
        onSelectVariant={handleVariantSelect}
      />

      {/* Bulk Discount Modal */}
      <BulkDiscountModal
        opened={shortcutsHook.bulkDiscountModalOpen}
        onClose={shortcutsHook.closeBulkDiscountModal}
        onApply={handleApplyBulkDiscount}
      />

      {/* Target Total Modal */}
      <TargetTotalModal
        opened={shortcutsHook.targetTotalModalOpen}
        onClose={shortcutsHook.closeTargetTotalModal}
        onApply={handleApplyBulkDiscount}
        currentSubTotal={totals.subTotal}
        taxRate={taxRate}
        isTaxable={formState.isTaxable}
        formatCurrency={formatCurrency}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsModal opened={shortcutsHook.shortcutsModalOpen} onClose={shortcutsHook.closeShortcutsModal} />

      {/* Delete Confirmation Modal */}
      <Modal opened={shortcutsHook.deleteConfirmOpen} onClose={shortcutsHook.closeDeleteConfirm} title="Delete Line Item" centered>
        <Stack gap="md">
          <Text>
            Are you sure you want to delete &quot;{shortcutsHook.itemToDelete?.description || shortcutsHook.itemToDelete?.sku}&quot;?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={shortcutsHook.closeDeleteConfirm}>Cancel</Button>
            <Button color="red" onClick={() => shortcutsHook.handleConfirmDelete(removeLineItem)}>Delete</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Payment Entry Modal */}
      <PaymentEntryModal
        opened={paymentEntryModalOpen}
        onClose={closePaymentEntryModal}
        onSubmit={handleCreateInvoiceWithPayment}
        invoiceTotal={totals.total}
        clientId={formState.clientId}
      />

      {/* Floating Alerts */}
      <FloatingAlerts creditCheck={creditCheck} inventoryWarnings={inventoryWarnings} />
    </>
  );
}
