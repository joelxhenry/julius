import { useState, useCallback, useEffect, useMemo } from 'react';

export interface LineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  isTaxable: boolean;
  amount: number;
  inventoryId?: number;
  isVariant?: boolean;
}

export type EditableField = 'quantity' | 'unitPrice' | 'discount';

export interface EditingCell {
  rowId: string | null;
  field: EditableField | null;
}

interface UseLineItemsOptions {
  taxRate?: number;
  isTaxable?: boolean;
}

export function useLineItems(options: UseLineItemsOptions = {}) {
  const { taxRate = 0, isTaxable = true } = options;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>({ rowId: null, field: null });

  // Auto-select first line item when items are added
  useEffect(() => {
    if (lineItems.length > 0 && !selectedId) {
      setSelectedId(lineItems[0].id);
    }
  }, [lineItems, selectedId]);

  // Clear selection if selected item is removed
  useEffect(() => {
    if (selectedId && !lineItems.find((item) => item.id === selectedId)) {
      setSelectedId(lineItems.length > 0 ? lineItems[0].id : null);
    }
  }, [lineItems, selectedId]);

  // Calculate totals
  const totals = useMemo(() => {
    const subTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxableAmount = lineItems.filter((item) => item.isTaxable).reduce((sum, item) => sum + item.amount, 0);
    const tax = isTaxable ? taxableAmount * taxRate : 0;
    const total = subTotal + tax;
    return { subTotal, tax, total };
  }, [lineItems, isTaxable, taxRate]);

  const addItem = useCallback((item: Omit<LineItem, 'id' | 'amount'>) => {
    const amount = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const newItem: LineItem = {
      ...item,
      id: `new-${Date.now()}`,
      amount,
    };
    setLineItems((prev) => [...prev, newItem]);
    return newItem;
  }, []);

  const updateItem = useCallback((itemId: string, field: keyof LineItem, value: any) => {
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

  const removeItem = useCallback((itemId: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const applyBulkDiscount = useCallback((discountPercent: number) => {
    setLineItems((prev) =>
      prev.map((item) => ({
        ...item,
        discount: discountPercent,
        amount: item.quantity * item.unitPrice * (1 - discountPercent / 100),
      }))
    );
  }, []);

  const selectNext = useCallback(() => {
    if (lineItems.length === 0) return;
    const currentIndex = lineItems.findIndex((item) => item.id === selectedId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % lineItems.length;
    setSelectedId(lineItems[nextIndex].id);
  }, [lineItems, selectedId]);

  const selectPrevious = useCallback(() => {
    if (lineItems.length === 0) return;
    const currentIndex = lineItems.findIndex((item) => item.id === selectedId);
    const prevIndex = currentIndex === -1 ? lineItems.length - 1 : (currentIndex - 1 + lineItems.length) % lineItems.length;
    setSelectedId(lineItems[prevIndex].id);
  }, [lineItems, selectedId]);

  const setItems = useCallback((items: LineItem[]) => {
    setLineItems(items);
  }, []);

  const clear = useCallback(() => {
    setLineItems([]);
    setSelectedId(null);
  }, []);

  const getSelectedItem = useCallback(() => {
    return lineItems.find((item) => item.id === selectedId) || null;
  }, [lineItems, selectedId]);

  const startEditing = useCallback((rowId: string, field: EditableField) => {
    setSelectedId(rowId);
    setEditingCell({ rowId, field });
  }, []);

  const stopEditing = useCallback(() => {
    setEditingCell({ rowId: null, field: null });
  }, []);

  const editNextField = useCallback(() => {
    if (!editingCell.rowId || !editingCell.field) return;

    const fields: EditableField[] = ['quantity', 'unitPrice', 'discount'];
    const currentIndex = fields.indexOf(editingCell.field);
    const nextIndex = (currentIndex + 1) % fields.length;

    if (nextIndex === 0) {
      // Wrapped around - move to next row
      const currentRowIndex = lineItems.findIndex((item) => item.id === editingCell.rowId);
      if (currentRowIndex < lineItems.length - 1) {
        const nextRowId = lineItems[currentRowIndex + 1].id;
        setSelectedId(nextRowId);
        setEditingCell({ rowId: nextRowId, field: 'quantity' });
      } else {
        stopEditing();
      }
    } else {
      setEditingCell({ rowId: editingCell.rowId, field: fields[nextIndex] });
    }
  }, [editingCell, lineItems, stopEditing]);

  const editPreviousField = useCallback(() => {
    if (!editingCell.rowId || !editingCell.field) return;

    const fields: EditableField[] = ['quantity', 'unitPrice', 'discount'];
    const currentIndex = fields.indexOf(editingCell.field);

    if (currentIndex === 0) {
      // At first field - move to previous row's last field
      const currentRowIndex = lineItems.findIndex((item) => item.id === editingCell.rowId);
      if (currentRowIndex > 0) {
        const prevRowId = lineItems[currentRowIndex - 1].id;
        setSelectedId(prevRowId);
        setEditingCell({ rowId: prevRowId, field: 'discount' });
      } else {
        stopEditing();
      }
    } else {
      setEditingCell({ rowId: editingCell.rowId, field: fields[currentIndex - 1] });
    }
  }, [editingCell, lineItems, stopEditing]);

  return {
    items: lineItems,
    selectedId,
    totals,
    editingCell,
    setSelectedId,
    addItem,
    updateItem,
    removeItem,
    applyBulkDiscount,
    selectNext,
    selectPrevious,
    setItems,
    clear,
    getSelectedItem,
    startEditing,
    stopEditing,
    editNextField,
    editPreviousField,
  };
}
