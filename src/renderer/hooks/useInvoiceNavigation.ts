import { useState, useCallback, useEffect, useRef } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { useTabManager } from '../contexts/TabManagerContext';
import type { Invoice } from '../../main/database/schema';

export interface AdjacentInvoicesWithData {
  previousId: number | null;
  nextId: number | null;
  previousInvoice: Invoice | null;
  nextInvoice: Invoice | null;
}

export interface UseInvoiceNavigationResult {
  previousInvoiceId: number | null;
  nextInvoiceId: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
  goToPrevious: () => void;
  goToNext: () => void;
  loading: boolean;
  // Cached invoice data for instant navigation
  previousInvoiceData: Invoice | null;
  nextInvoiceData: Invoice | null;
}

// Module-level cache for invoice data - persists across hook instances
// This allows navigation to be instant when moving between invoices
const invoiceCache = new Map<number, Invoice>();
const MAX_CACHE_SIZE = 10;

// Helper to manage cache size
function addToCache(id: number, invoice: Invoice) {
  // Remove oldest entries if cache is full
  if (invoiceCache.size >= MAX_CACHE_SIZE) {
    const firstKey = invoiceCache.keys().next().value;
    if (firstKey !== undefined) {
      invoiceCache.delete(firstKey);
    }
  }
  invoiceCache.set(id, invoice);
}

export function getCachedInvoice(id: number): Invoice | null {
  return invoiceCache.get(id) ?? null;
}

interface UseInvoiceNavigationOptions {
  tabId: string;
  onNavigate?: (invoiceId: number, cachedInvoice: any) => void;
}

export function useInvoiceNavigation(
  currentInvoiceId: number | null,
  options?: UseInvoiceNavigationOptions
): UseInvoiceNavigationResult {
  const { updateTab } = useTabManager();
  const [adjacentData, setAdjacentData] = useState<AdjacentInvoicesWithData>({
    previousId: null,
    nextId: null,
    previousInvoice: null,
    nextInvoice: null,
  });
  const [loading, setLoading] = useState(false);
  const fetchedForIdRef = useRef<number | null>(null);

  // Fetch adjacent invoices with full data when current invoice changes
  useEffect(() => {
    const fetchAdjacent = async () => {
      if (!currentInvoiceId) {
        setAdjacentData({
          previousId: null,
          nextId: null,
          previousInvoice: null,
          nextInvoice: null,
        });
        return;
      }

      // Skip if we've already fetched for this ID
      if (fetchedForIdRef.current === currentInvoiceId) {
        return;
      }

      setLoading(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ADJACENT_INVOICES_WITH_DATA, {
          id: currentInvoiceId,
        });
        const data = result.data || result;

        // Cache the fetched invoice data
        if (data.previousInvoice) {
          addToCache(data.previousInvoice.id, data.previousInvoice);
        }
        if (data.nextInvoice) {
          addToCache(data.nextInvoice.id, data.nextInvoice);
        }

        setAdjacentData({
          previousId: data.previousId ?? null,
          nextId: data.nextId ?? null,
          previousInvoice: data.previousInvoice ?? null,
          nextInvoice: data.nextInvoice ?? null,
        });
        fetchedForIdRef.current = currentInvoiceId;
      } catch (error) {
        console.error('Failed to fetch adjacent invoices:', error);
        setAdjacentData({
          previousId: null,
          nextId: null,
          previousInvoice: null,
          nextInvoice: null,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAdjacent();
  }, [currentInvoiceId]);

  // Navigate within the same tab
  const navigateToInvoice = useCallback((invoiceId: number, cachedInvoice: Invoice | null) => {
    if (options?.tabId) {
      const title = cachedInvoice?.invoiceNumber
        ? `Invoice #${cachedInvoice.invoiceNumber}`
        : 'Invoice';
      updateTab(options.tabId, `/invoices/${invoiceId}`, title, invoiceId.toString());
    }
    // Trigger the callback to load the invoice data in the page
    options?.onNavigate?.(invoiceId, cachedInvoice);
  }, [options, updateTab]);

  const goToPrevious = useCallback(() => {
    if (adjacentData.previousId) {
      navigateToInvoice(adjacentData.previousId, adjacentData.previousInvoice);
    }
  }, [adjacentData.previousId, adjacentData.previousInvoice, navigateToInvoice]);

  const goToNext = useCallback(() => {
    if (adjacentData.nextId) {
      navigateToInvoice(adjacentData.nextId, adjacentData.nextInvoice);
    }
  }, [adjacentData.nextId, adjacentData.nextInvoice, navigateToInvoice]);

  return {
    previousInvoiceId: adjacentData.previousId,
    nextInvoiceId: adjacentData.nextId,
    hasPrevious: adjacentData.previousId !== null,
    hasNext: adjacentData.nextId !== null,
    goToPrevious,
    goToNext,
    loading,
    previousInvoiceData: adjacentData.previousInvoice,
    nextInvoiceData: adjacentData.nextInvoice,
  };
}
