import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import { useMarkedItems, MarkedItem, DraftDocType } from './useMarkedItems';
import { useTabPath } from '../components/layout/TabContainer';

export type DraftLineItemInput = {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  isTaxable: boolean;
  inventoryId?: number;
  isVariant: boolean;
};

interface UseTrayDraftIntegrationArgs {
  docType: DraftDocType;
  /** True when the page is mounted and ready to accept items (e.g. not still loading edit data). */
  enabled: boolean;
  /** Pricing mode from the form. 'W' = wholesale (cost * 1.15); anything else uses retail price. */
  pricing: string;
  /** Adds one line item to the destination page's local line-item state. */
  addItem: (item: DraftLineItemInput) => void;
}

/**
 * Wires a create page to the marked-items tray:
 *   - On mount with `location.state.fromTray`, drains the tray, re-fetches each item per Q-B6,
 *     and feeds them into the page via `addItem`.
 *   - Registers a draft handler so the tray's "Add to current X" button can append while open.
 */
export function useTrayDraftIntegration({
  docType,
  enabled,
  pricing,
  addItem,
}: UseTrayDraftIntegrationArgs) {
  const location = useLocation();
  const tabPath = useTabPath();
  const { consume, consumeKeys, registerDraftHandler } = useMarkedItems();
  const consumedRef = useRef(false);

  // Latest addItem / pricing held in refs so `append` (and the registered handler)
  // stay stable across renders even when callers pass new closures each render.
  // Otherwise the register effect would re-run every render, repeatedly calling
  // setDraftHandler and triggering an infinite update loop.
  const addItemRef = useRef(addItem);
  const pricingRef = useRef(pricing);
  useEffect(() => {
    addItemRef.current = addItem;
  }, [addItem]);
  useEffect(() => {
    pricingRef.current = pricing;
  }, [pricing]);

  const append = useCallback(async (items: MarkedItem[]) => {
    let added = 0;
    let skipped = 0;
    for (const t of items) {
      const data = await fetchLineItem(t, pricingRef.current);
      if (data) {
        addItemRef.current({ ...data, quantity: t.quantity || 1 });
        added++;
      } else {
        skipped++;
      }
    }
    if (added > 0) {
      notifications.show({
        title: 'Items added from tray',
        message:
          skipped > 0
            ? `${added} added, ${skipped} skipped (no longer in inventory).`
            : `${added} item${added === 1 ? '' : 's'} added.`,
        color: skipped > 0 ? 'yellow' : 'green',
      });
    } else if (skipped > 0) {
      notifications.show({
        title: 'No items added',
        message: `${skipped} marked item${skipped === 1 ? '' : 's'} could not be loaded.`,
        color: 'orange',
      });
    }
  }, []);

  // On-mount auto-prefill when arriving via router state.fromTray.
  // If the tray passed a `keys` subset, consume only those; otherwise drain all.
  useEffect(() => {
    if (!enabled) return;
    const state = location.state as { fromTray?: boolean; keys?: string[] } | null;
    if (!state?.fromTray || consumedRef.current) return;
    consumedRef.current = true;
    const items = state.keys && state.keys.length > 0 ? consumeKeys(state.keys) : consume();
    if (items.length > 0) {
      void append(items);
    }
  }, [enabled, location.state, consume, consumeKeys, append]);

  // Register draft handler so the tray's "Add to current X" can append in place.
  // Capture the tab's path (or location.pathname when not in a tab) so the tray can
  // switch to this tab after appending.
  const path = tabPath ?? location.pathname;
  useEffect(() => {
    if (!enabled) return;
    return registerDraftHandler({
      docType,
      label: docType === 'invoice' ? 'current invoice' : 'current quotation',
      path,
      append,
    });
  }, [enabled, docType, append, path, registerDraftHandler]);
}

async function fetchLineItem(
  t: MarkedItem,
  pricing: string
): Promise<Omit<DraftLineItemInput, 'quantity'> | null> {
  if (t.isVariant) {
    const r = await window.electron.invoke(IpcChannel.GET_VARIANT_BY_SKU, { variantSku: t.partNumber });
    if (!r?.success || !r.data) return null;
    const v = r.data as {
      variantSku: string;
      variantName: string | null;
      description: string | null;
      price: string | null;
      cost: string | null;
    };
    const cost = parseFloat(v.cost ?? '0');
    const price = parseFloat(v.price ?? '0');
    const unitPrice = pricing === 'W' ? cost * 1.15 : price;
    return {
      sku: v.variantSku,
      description: v.description ?? v.variantName ?? t.description ?? '',
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      isTaxable: t.isTaxable,
      inventoryId: t.inventoryId,
      isVariant: true,
    };
  }

  const r = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku: t.partNumber });
  if (!r?.success || !r.data) return null;
  const inv = r.data as {
    id: number;
    sku: string;
    description1: string | null;
    price: string | null;
    cost: string | null;
    isTaxable: boolean;
  };
  const cost = parseFloat(inv.cost ?? '0');
  const price = parseFloat(inv.price ?? '0');
  const unitPrice = pricing === 'W' ? cost * 1.15 : price;
  return {
    sku: inv.sku,
    description: inv.description1 ?? '',
    unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
    isTaxable: inv.isTaxable,
    inventoryId: inv.id,
    isVariant: false,
  };
}
