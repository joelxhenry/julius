import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Loader,
  Center,
  ActionIcon,
  Modal,
  Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconKeyboard,
  IconCash,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { useKeyboardShortcutContext } from '../../contexts/KeyboardShortcutContext';
import { PinVerificationModal } from '../../components/auth/PinVerificationModal';
import {
  AdminOverrideModal,
  InvoiceFormHeader,
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
import { useClientSearch, Client, useInventorySearch, useLineItems, LineItem } from '../../hooks';

interface LocationState {
  salespersonId?: number;
  salespersonName?: string;
}

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { user } = useAuth();
  const { markTabDirty, updateTabTitle } = useTabContext();
  const { registerShortcuts, unregisterShortcuts } = useKeyboardShortcutContext();
  const locationState = location.state as LocationState | null;

  const isEditing = !!id;

  // Debug logging
  useEffect(() => {
    console.log('[InvoiceCreatePage] id:', id, 'isEditing:', isEditing, 'location:', location.pathname);
  }, [id, isEditing, location.pathname]);

  // Form state
  const [invDate, setInvDate] = useState<Date>(new Date());
  const [reference, setReference] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [isTaxable, setIsTaxable] = useState(true);
  const [pricing, setPricing] = useState('R'); // R = Retail, W = Wholesale
  const [creditTerms, setCreditTerms] = useState('');
  const [salespersonId, setSalespersonId] = useState<number | null>(locationState?.salespersonId ?? null);
  const [salespersonName, setSalespersonName] = useState<string>(locationState?.salespersonName ?? '');
  const [originalInvNumber, setOriginalInvNumber] = useState<string | null>(null);

  // Tax rate from system settings
  const { taxRate } = useTaxRate();

  // Line items hook - handles CRUD, selection, and totals calculation
  const {
    items: lineItems,
    selectedId: selectedLineItemId,
    totals,
    setSelectedId: setSelectedLineItemId,
    addItem: addLineItem,
    updateItem: updateLineItem,
    removeItem: removeLineItem,
    applyBulkDiscount,
    selectNext: selectNextLineItem,
    selectPrevious: selectPreviousLineItem,
    setItems: setLineItems,
  } = useLineItems({ taxRate, isTaxable });

  // Focus trigger for keyboard shortcuts
  const [focusTrigger, setFocusTrigger] = useState<{ field: 'quantity' | 'discount' | null; timestamp: number }>({
    field: null,
    timestamp: 0,
  });

  // Refs for auto-focus
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const inventorySearchRef = useRef<HTMLInputElement>(null);
  const pricingSelectRef = useRef<HTMLInputElement>(null);

  // Credit check
  const [creditCheck, setCreditCheck] = useState<CreditCheckResult | null>(null);

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
      setClientId(selectedClient.id);
      setIsTaxable(selectedClient.isTaxable);
      setCreditTerms(selectedClient.creditTerms || '');
      checkClientCredit(selectedClient.id);
      // Auto-focus pricing field after client selection
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

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [overrideModalOpen, { open: openOverrideModal, close: closeOverrideModal }] = useDisclosure(false);
  const [issueModalOpen, { open: openIssueModal, close: closeIssueModal }] = useDisclosure(false);

  // Payment entry modal for atomic transaction flow
  const [paymentEntryModalOpen, { open: openPaymentEntryModal, close: closePaymentEntryModal }] = useDisclosure(false);
  const [isPaymentFlow, setIsPaymentFlow] = useState(false);
  const [adminOverride, setAdminOverride] = useState<AdminOverrideResult | undefined>(undefined);

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

  // Inventory check hook - checks inventory in real-time as quantities change
  const { inventoryWarnings, isChecking: isCheckingInventory, hasWarnings } = useInventoryCheck(
    lineItems.map(item => ({ sku: item.sku, quantity: item.quantity }))
  );

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
        setInvDate(new Date(inv.invDate));
        setReference(inv.reference || '');
        setClientId(inv.clientId);
        setIsTaxable(inv.isTaxable);
        setPricing(inv.pricing);
        setCreditTerms(inv.creditTerms || '');
        setSalespersonId(inv.salespersonId);
        setOriginalInvNumber(inv.invNumber);

        // Update tab title (only if this is the active tab)
        if (location.pathname === `/invoices/form/${id}`) {
          updateTabTitle(location.pathname, `Edit Invoice ${inv.invNumber}`);
        }

        // Load client
        if (inv.clientId) {
          const clientResult = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: inv.clientId });
          if (clientResult.success && clientResult.data) {
            setClient(clientResult.data);
            setClientSearch(clientResult.data.clientName);
          }
        }

        // Load line items
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

  // Track dirty state - mark tab as dirty when there are changes
  useEffect(() => {
    const hasChanges = lineItems.length > 0 || clientId !== null || reference !== '';
    markTabDirty(location.pathname, hasChanges);
  }, [lineItems, clientId, reference, location.pathname, markTabDirty]);


  // Add line item from inventory item (used after variant selection or for non-variant items)
  const addLineItemFromInventory = useCallback(
    (item: InventoryItem, sku?: string, description?: string, isVariant: boolean = false) => {
      const unitPrice = pricing === 'W' ? parseFloat(item.cost || '0') * 1.15 : parseFloat(item.price || '0');

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

      // Auto-focus inventory search field after adding item
      setTimeout(() => {
        inventorySearchRef.current?.focus();
      }, 100);
    },
    [pricing, addLineItem, clearItemSearch]
  );

  // Handle variant selection
  const handleVariantSelect = useCallback(
    (variant: any) => {
      if (pendingItem) {
        // Use variant SKU and name, but pricing from parent item (or variant price if available)
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

  // Handle item selection - check for variants first
  const handleItemSelect = useCallback(
    async (value: string) => {
      const option = itemOptions.find((o) => o.value === value);
      if (option) {
        const item = option.item;

        // Check if item has variants
        const hasVariants = await checkHasVariants(item.sku);

        if (hasVariants) {
          // Load variants and show selector modal
          setPendingItem(item);
          await loadVariants(item.sku);
          openVariantModal();
        } else {
          // No variants, add item directly
          addLineItemFromInventory(item);
        }
      }
    },
    [itemOptions, checkHasVariants, loadVariants, addLineItemFromInventory, openVariantModal]
  );

  // Apply bulk discount with notification
  const handleApplyBulkDiscount = useCallback((discountPercent: number) => {
    applyBulkDiscount(discountPercent);
    notifications.show({
      title: 'Discount Applied',
      message: `${discountPercent}% discount applied to all line items`,
      color: 'green',
    });
  }, [applyBulkDiscount]);

  // Issue invoice directly
  const handleIssueInvoice = useCallback(async () => {
    if (creditCheck?.requiresAdminOverride) {
      openOverrideModal();
      return;
    }

    // Need to verify salesperson first
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Handle save & process payment - initiates the flow
  const handleSaveAndProcessPayment = useCallback(async () => {
    if (creditCheck?.requiresAdminOverride) {
      setIsPaymentFlow(true);
      openOverrideModal();
      return;
    }

    setIsPaymentFlow(true);
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Show payment entry modal (after verification)
  const handleShowPaymentEntry = useCallback(
    async (override?: AdminOverrideResult) => {
      if (lineItems.length === 0) {
        notifications.show({
          title: 'Error',
          message: 'Please add at least one line item',
          color: 'red',
        });
        return;
      }

      // Store admin override for later use
      setAdminOverride(override);

      // Show payment entry modal
      openPaymentEntryModal();
    },
    [lineItems, openPaymentEntryModal]
  );

  // Handle create invoice with payment (atomic transaction)
  const handleCreateInvoiceWithPayment = useCallback(
    async (paymentEntries: PaymentEntry[]) => {
      setIsSaving(true);
      try {
        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_WITH_PAYMENT, {
          invoiceData: {
            invDate: invDate.toISOString().split('T')[0],
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
            creditTerms: creditTerms || null,
            issuedAt: new Date(),
            issuedById: salespersonId,
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
          processedById: salespersonId!,
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
            warnings.forEach((w: string) =>
              notifications.show({ message: w, color: 'yellow' })
            );
          }

          navigate(`/invoices/${invoice.id}`);
        } else {
          // Transaction rolled back - no cleanup needed
          notifications.show({
            title: 'Error',
            message: result.error,
            color: 'red',
          });
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
    [
      invDate,
      salespersonId,
      clientId,
      client,
      reference,
      totals,
      isTaxable,
      pricing,
      creditTerms,
      lineItems,
      navigate,
      closePaymentEntryModal,
      adminOverride,
    ]
  );

  // Register keyboard shortcuts for line items
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
          handleIssueInvoice();
        },
        description: 'Save and issue invoice',
      },
      {
        key: 'p',
        ctrl: true,
        shift: true,
        callback: () => {
          handleSaveAndProcessPayment();
        },
        description: 'Save and process payment',
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

    registerShortcuts('invoice-line-items', shortcuts);

    return () => {
      unregisterShortcuts('invoice-line-items');
    };
  }, [selectedLineItemId, lineItems, removeLineItem, openBulkDiscountModal, openTargetTotalModal, handleIssueInvoice, handleSaveAndProcessPayment, selectPreviousLineItem, selectNextLineItem, registerShortcuts, unregisterShortcuts]);

  // Handle issue after verification
  const handleIssueVerified = useCallback(
    async (adminOverride?: AdminOverrideResult) => {
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
        const invoiceData = {
          invDate: invDate.toISOString().split('T')[0],
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
          totalPaid: '0',
          status: 'active',
          isTaxable,
          pricing,
          creditTerms: creditTerms || null,
          issuedAt: new Date(),
          issuedById: salespersonId,
          ...(adminOverride && {
            adminOverrideById: adminOverride.adminId,
            adminOverrideNotes: adminOverride.notes,
            adminOverrideAt: new Date(),
          }),
        };

        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create invoice');
        }

        const invoiceId = result.data.id;
        const invNumber = result.data.invNumber;

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

        // Create inventory transactions (reduce stock)
        const transactionResult = await window.electron.invoke(IpcChannel.CREATE_INVOICE_TRANSACTIONS, {
          invNumber,
          lineItems: lineItems.map(item => ({ sku: item.sku, quantity: item.quantity })),
          invDate: invDate.toISOString().split('T')[0],
        });

        if (!transactionResult.success) {
          console.error('Warning: Failed to create inventory transactions:', transactionResult.error);
          // Don't fail the entire operation, just warn
          notifications.show({
            title: 'Warning',
            message: 'Invoice created but inventory may not have been updated',
            color: 'yellow',
          });
        }

        notifications.show({
          title: 'Success',
          message: `Invoice ${invNumber} created and issued`,
          color: 'green',
        });

        navigate(`/invoices/${invoiceId}`);
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
    },
    [invDate, salespersonId, clientId, client, reference, totals, isTaxable, pricing, creditTerms, lineItems, navigate]
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
      <Stack gap="md" pb={10}>
        {/* Compact Header with Summary */}
        <Paper withBorder p="md" radius="md">
          <Group justify="space-between" wrap="nowrap">
            {/* Left: Invoice Info */}
            <Group gap="lg" wrap="nowrap">
              <Stack gap={2}>
                <Title order={3}>{isEditing ? `Edit Invoice ${originalInvNumber || ''}` : 'New Invoice'}</Title>
                <Group gap="xs">
                  {salespersonName && (
                    <Text size="sm" c="dimmed">Salesperson: {salespersonName}</Text>
                  )}
                  {client && (
                    <>
                      {salespersonName && <Text size="sm" c="dimmed">•</Text>}
                      <Text size="sm" c="dimmed">{client.clientName}</Text>
                    </>
                  )}
                </Group>
              </Stack>
            </Group>

            {/* Center: Summary Totals */}
            <Group gap="xl" wrap="nowrap">
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed" tt="uppercase">Subtotal</Text>
                <Text size="lg" fw={600}>{formatCurrency(totals.subTotal)}</Text>
              </Stack>
              {isTaxable && (
                <Stack gap={0} align="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Tax</Text>
                  <Text size="lg" fw={600}>{formatCurrency(totals.tax)}</Text>
                </Stack>
              )}
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed" tt="uppercase">Total</Text>
                <Text size="xl" fw={700} c="blue">{formatCurrency(totals.total)}</Text>
              </Stack>
            </Group>

            {/* Right: Actions */}
            <Group gap="sm" wrap="nowrap">
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
                size="sm"
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={handleIssueInvoice}
                loading={isSaving}
                disabled={lineItems.length === 0}
              >
                Save & Issue
              </Button>
              <Button
                size="sm"
                color="teal"
                leftSection={<IconCash size={16} />}
                onClick={handleSaveAndProcessPayment}
                loading={isSaving}
                disabled={lineItems.length === 0}
              >
                Save & Pay
              </Button>
            </Group>
          </Group>
        </Paper>


        {/* Client & Invoice Details - Full Width */}
        <InvoiceFormHeader
          invDate={invDate}
          setInvDate={setInvDate}
          reference={reference}
          setReference={setReference}
          client={client}
          clientSearch={clientSearch}
          setClientSearch={setClientSearch}
          clientOptions={clientOptions}
          isSearchingClients={isSearchingClients}
          onClientSearchChange={searchClients}
          onClientSelect={handleClientSelectInternal}
          pricing={pricing}
          setPricing={setPricing}
          creditTerms={creditTerms}
          setCreditTerms={setCreditTerms}
          isTaxable={isTaxable}
          setIsTaxable={setIsTaxable}
          referenceInputRef={referenceInputRef}
          inventorySearchRef={inventorySearchRef}
          pricingSelectRef={pricingSelectRef}
        />

        {/* Line Items - Full Width, Prominent */}
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
          focusTrigger={focusTrigger}
          inventorySearchRef={inventorySearchRef}
        />
      </Stack>

      {/* Admin Override Modal */}
      {creditCheck && (
        <AdminOverrideModal
          opened={overrideModalOpen}
          onClose={() => {
            closeOverrideModal();
            setIsPaymentFlow(false);
          }}
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
        onClose={() => {
          closeIssueModal();
          setIsPaymentFlow(false);
        }}
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

      {/* Payment Entry Modal */}
      <PaymentEntryModal
        opened={paymentEntryModalOpen}
        onClose={closePaymentEntryModal}
        onSubmit={handleCreateInvoiceWithPayment}
        invoiceTotal={totals.total}
        clientId={clientId}
      />

      {/* Floating Alerts */}
      <FloatingAlerts
        creditCheck={creditCheck}
        inventoryWarnings={inventoryWarnings}
      />
    </>
  );
}
