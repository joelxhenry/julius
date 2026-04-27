import { IpcChannel } from '../../shared/types/ipc';
import type { MarkButtonItem } from '../components/tray/MarkButton';

interface FetchedInventory {
  id: number;
  sku: string;
  description1: string | null;
  isTaxable: boolean;
  price: string | null;
  cost: string | null;
}

interface FetchedVariant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  description: string | null;
  price: string | null;
  cost: string | null;
  isBase: boolean;
}

/**
 * Resolves the base variant for an inventory item to a tray-ready MarkButtonItem.
 *
 * Line items in invoices/quotations always reference variants — never base inventory items —
 * so when a user marks a base item we silently substitute its base variant. Every inventory
 * item is expected to have exactly one variant flagged `is_base = true` (see schema +
 * `seedBaseVariants`). Returns null if the inventory item or its base variant is missing.
 */
export async function resolveBaseVariant(parentSku: string): Promise<MarkButtonItem | null> {
  const [invRes, variantsRes] = await Promise.all([
    window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku: parentSku }),
    window.electron.invoke(IpcChannel.GET_INVENTORY_VARIANTS, { parentSku }),
  ]);

  if (!invRes?.success || !invRes.data) return null;
  if (!variantsRes?.success || !Array.isArray(variantsRes.data)) return null;

  const inv = invRes.data as FetchedInventory;
  const variants = variantsRes.data as FetchedVariant[];
  const base = variants.find((v) => v.isBase);
  if (!base) return null;

  const price = parseFloat(base.price ?? '0');
  return {
    partNumber: base.variantSku,
    description: base.description ?? base.variantName ?? inv.description1 ?? '',
    unitPrice: Number.isFinite(price) ? price : 0,
    isTaxable: inv.isTaxable,
    isVariant: true,
    parentPartNumber: parentSku,
    inventoryId: inv.id,
  };
}
