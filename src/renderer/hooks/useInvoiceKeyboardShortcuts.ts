import { useEffect, useState, useCallback } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useKeyboardShortcutContext } from '../contexts/KeyboardShortcutContext';
import { LineItem } from './useLineItems';

interface UseInvoiceKeyboardShortcutsOptions {
  lineItems: LineItem[];
  selectedLineItemId: string | null;
  selectNextLineItem: () => void;
  selectPreviousLineItem: () => void;
  onIssueInvoice: () => void;
  onSaveAndPay: () => void;
  // Enhanced editing support
  onStartEditing?: (rowId: string, field: 'quantity' | 'unitPrice' | 'discount') => void;
  onStopEditing?: () => void;
  editingCell?: { rowId: string | null; field: 'quantity' | 'unitPrice' | 'discount' | null };
}

export function useInvoiceKeyboardShortcuts({
  lineItems,
  selectedLineItemId,
  selectNextLineItem,
  selectPreviousLineItem,
  onIssueInvoice,
  onSaveAndPay,
  onStartEditing,
  onStopEditing,
  editingCell,
}: UseInvoiceKeyboardShortcutsOptions) {
  const { registerShortcuts, unregisterShortcuts } = useKeyboardShortcutContext();
  const isEditing = editingCell?.rowId !== null && editingCell?.field !== null;

  // Focus trigger for keyboard shortcuts
  const [focusTrigger, setFocusTrigger] = useState<{ field: 'quantity' | 'discount' | null; timestamp: number }>({
    field: null,
    timestamp: 0,
  });

  // Delete confirmation modal
  const [deleteConfirmOpen, { open: openDeleteConfirm, close: closeDeleteConfirm }] = useDisclosure(false);
  const [itemToDelete, setItemToDelete] = useState<LineItem | null>(null);

  // Bulk discount modal
  const [bulkDiscountModalOpen, { open: openBulkDiscountModal, close: closeBulkDiscountModal }] = useDisclosure(false);

  // Target total modal
  const [targetTotalModalOpen, { open: openTargetTotalModal, close: closeTargetTotalModal }] = useDisclosure(false);

  // Keyboard shortcuts help modal
  const [shortcutsModalOpen, { open: openShortcutsModal, close: closeShortcutsModal }] = useDisclosure(false);

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
          onIssueInvoice();
        },
        description: 'Save and issue invoice',
      },
      {
        key: 'p',
        ctrl: true,
        shift: true,
        callback: () => {
          onSaveAndPay();
        },
        description: 'Save and process payment',
      },
      {
        key: 'ArrowUp',
        callback: () => {
          if (!isEditing) {
            selectPreviousLineItem();
          }
        },
        description: 'Select previous line item',
      },
      {
        key: 'ArrowDown',
        callback: () => {
          if (!isEditing) {
            selectNextLineItem();
          }
        },
        description: 'Select next line item',
      },
      // Vim-style navigation
      {
        key: 'k',
        callback: () => {
          if (!isEditing) {
            selectPreviousLineItem();
          }
        },
        description: 'Select previous line item (vim)',
      },
      {
        key: 'j',
        callback: () => {
          if (!isEditing) {
            selectNextLineItem();
          }
        },
        description: 'Select next line item (vim)',
      },
      // Enter to start editing
      {
        key: 'Enter',
        callback: () => {
          if (!isEditing && selectedLineItemId && onStartEditing) {
            onStartEditing(selectedLineItemId, 'quantity');
          }
        },
        description: 'Edit quantity of selected line item',
      },
      // Escape to stop editing
      {
        key: 'Escape',
        callback: () => {
          if (isEditing && onStopEditing) {
            onStopEditing();
          }
        },
        description: 'Stop editing',
      },
    ];

    registerShortcuts('invoice-line-items', shortcuts);

    return () => {
      unregisterShortcuts('invoice-line-items');
    };
  }, [
    selectedLineItemId,
    lineItems,
    openBulkDiscountModal,
    openTargetTotalModal,
    onIssueInvoice,
    onSaveAndPay,
    selectPreviousLineItem,
    selectNextLineItem,
    registerShortcuts,
    unregisterShortcuts,
    openDeleteConfirm,
    isEditing,
    onStartEditing,
    onStopEditing,
  ]);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(
    (removeLineItem: (id: string) => void) => {
      if (itemToDelete) {
        removeLineItem(itemToDelete.id);
        closeDeleteConfirm();
        setItemToDelete(null);
      }
    },
    [itemToDelete, closeDeleteConfirm]
  );

  return {
    focusTrigger,
    // Delete confirmation
    deleteConfirmOpen,
    closeDeleteConfirm,
    itemToDelete,
    handleConfirmDelete,
    // Bulk discount modal
    bulkDiscountModalOpen,
    closeBulkDiscountModal,
    // Target total modal
    targetTotalModalOpen,
    closeTargetTotalModal,
    // Shortcuts help modal
    shortcutsModalOpen,
    openShortcutsModal,
    closeShortcutsModal,
  };
}
