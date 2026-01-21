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

interface UseLineItemsOptions {
  taxRate?: number;
  isTaxable?: boolean;
}

export function useLineItems(options: UseLineItemsOptions = {}) {
  const { taxRate = 0, isTaxable = true } = options;

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  return {
    items: lineItems,
    selectedId,
    totals,
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
  };
}
