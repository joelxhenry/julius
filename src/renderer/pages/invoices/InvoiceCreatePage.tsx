import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
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
  Alert,
  Modal,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconCheck,
  IconAlertTriangle,
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
  InvoiceSummaryCard,
  VariantSelectorModal,
  BulkDiscountModal,
  TargetTotalModal,
  KeyboardShortcutsModal,
  PaymentEntryModal,
  Client,
  InventoryItem,
  LineItem,
  CreditCheckResult,
  AdminOverrideResult,
  PaymentEntry,
  formatCurrency,
} from '../../components/invoices';
import { useInventoryCheck } from '../../hooks/useInventoryCheck';
import { useVariants } from '../../hooks/useVariants';
import { useTaxRate } from '../../hooks/useTaxRate';

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
  const [client, setClient] = useState<Client | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isTaxable, setIsTaxable] = useState(true);
  const [pricing, setPricing] = useState('R'); // R = Retail, W = Wholesale
  const [creditTerms, setCreditTerms] = useState('');
  const [salespersonId, setSalespersonId] = useState<number | null>(locationState?.salespersonId ?? null);
  const [salespersonName, setSalespersonName] = useState<string>(locationState?.salespersonName ?? '');
  const [originalInvNumber, setOriginalInvNumber] = useState<string | null>(null);

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

  // Credit check
  const [creditCheck, setCreditCheck] = useState<CreditCheckResult | null>(null);
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

  // Calculate totals
  const totals = useMemo(() => {
    const subTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = lineItems.filter((item) => item.isTaxable).reduce((sum, item) => sum + item.amount, 0);
    const tax = isTaxable ? taxableAmount * taxRate : 0;
    const total = subTotal + tax;
    return { subTotal, tax, total };
  }, [lineItems, isTaxable, taxRate]);

  // Load existing invoice if editing
  useEffect(() => {
    if (isEditing && id) {
      loadInvoice(parseInt(id, 10));
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
      // Selected item was removed, select first available item or null
      setSelectedLineItemId(lineItems.length > 0 ? lineItems[0].id : null);
    }
  }, [lineItems, selectedLineItemId]);

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

  // Handle client selection
  const handleClientSelect = useCallback(
    (value: string) => {
      const option = clientOptions.find((o) => o.value === value);
      if (option) {
        setClient(option.client);
        setClientId(option.client.id);
        setClientSearch(option.client.clientName);
        setIsTaxable(option.client.isTaxable);
        setCreditTerms(option.client.creditTerms || '');
        checkClientCredit(option.client.id);
      }
    },
    [clientOptions, checkClientCredit]
  );

  // Add line item from inventory item (used after variant selection or for non-variant items)
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

  // Update line item
  const updateLineItem = useCallback((itemId: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const updated = { ...item, [field]: value };

        // Recalculate amount
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

  // Apply bulk discount to all line items
  const handleApplyBulkDiscount = useCallback((discountPercent: number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        const updated = { ...item, discount: discountPercent };
        // Recalculate amount with new discount
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

  // Save invoice as draft
  const handleSaveDraft = useCallback(async () => {
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
        status: 'draft',
        isTaxable,
        pricing,
        creditTerms: creditTerms || null,
      };

      let invoiceId: number;
      let invNumber: string;

      if (isEditing && id) {
        const result = await window.electron.invoke(IpcChannel.UPDATE_INVOICE, {
          id: parseInt(id, 10),
          data: invoiceData,
        });
        if (!result.success) {
          throw new Error(result.error || 'Failed to update invoice');
        }
        invoiceId = parseInt(id, 10);
        invNumber = result.data.invNumber;
      } else {
        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create invoice');
        }
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

      notifications.show({
        title: 'Success',
        message: `Invoice ${invNumber} saved as draft`,
        color: 'green',
      });

      navigate(`/invoices/${invoiceId}`);
    } catch (error) {
      console.error('Failed to save invoice:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save invoice',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    isEditing,
    id,
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
  ]);

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
          handleSaveDraft();
        },
        description: 'Save invoice as draft',
      },
      {
        key: 's',
        ctrl: true,
        shift: true,
        callback: () => {
          handleIssueInvoice();
        },
        description: 'Issue invoice',
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
  }, [selectedLineItemId, lineItems, removeLineItem, openBulkDiscountModal, openTargetTotalModal, handleSaveDraft, handleIssueInvoice, handleSaveAndProcessPayment, selectPreviousLineItem, selectNextLineItem, registerShortcuts, unregisterShortcuts]);

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
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Stack gap={4}>
              <Title order={2}>{isEditing ? 'Edit Invoice' : 'New Invoice'}</Title>
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
            <Button variant="light" leftSection={<IconDeviceFloppy size={16} />} onClick={handleSaveDraft} loading={isSaving}>
              Save Draft
            </Button>
            <Button
              color="green"
              leftSection={<IconCheck size={16} />}
              onClick={handleIssueInvoice}
              loading={isSaving}
              disabled={lineItems.length === 0}
            >
              Save & Issue
            </Button>
            <Button
              color="teal"
              leftSection={<IconCash size={16} />}
              onClick={handleSaveAndProcessPayment}
              loading={isSaving}
              disabled={lineItems.length === 0}
            >
              Save & Process Payment
            </Button>
          </Group>
        </Group>

        {/* Credit Warning */}
        {creditCheck?.requiresAdminOverride && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Credit Issues Detected">
            {creditCheck.reasons.map((reason, idx) => (
              <Text key={idx} size="sm">
                {reason.message}
              </Text>
            ))}
            <Text size="sm" mt="xs" fw={500}>
              Admin override required to issue this invoice.
            </Text>
          </Alert>
        )}

        {/* Inventory Warning Summary */}
        {inventoryWarnings.length > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Inventory Availability Warning">
            <Text size="sm">
              {inventoryWarnings.length} item(s) have insufficient stock. See inline warnings below for details and
              alternatives.
            </Text>
            {inventoryWarnings.some(w => w.hasAlternates) && (
              <Text size="sm" mt="xs">
                Quick replace buttons are available for items with alternatives.
              </Text>
            )}
          </Alert>
        )}

        <Grid>
          {/* Invoice Details */}
          <Grid.Col span={{ base: 12, md: 8 }}>
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
              onClientSelect={handleClientSelect}
              pricing={pricing}
              setPricing={setPricing}
              creditTerms={creditTerms}
              setCreditTerms={setCreditTerms}
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
              inventoryWarnings={inventoryWarnings}
              isCheckingInventory={isCheckingInventory}
              selectedLineItemId={selectedLineItemId}
              onSelectLineItem={selectLineItem}
              focusTrigger={focusTrigger}
            />
          </Grid.Col>

          {/* Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <InvoiceSummaryCard
              lineItemCount={lineItems.length}
              totals={totals}
              isTaxable={isTaxable}
              isSaving={isSaving}
              hasLineItems={lineItems.length > 0}
              formatCurrency={formatCurrency}
              onSaveDraft={handleSaveDraft}
              onIssueInvoice={handleIssueInvoice}
            />
          </Grid.Col>
        </Grid>
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
    </>
  );
}
