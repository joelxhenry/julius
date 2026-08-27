import { useState, useEffect, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { InventorySearchResult } from '../../shared/types/inventory';

export type ProductSearchItem = InventorySearchResult;

interface UseProductSearchOptions {
  limit?: number;
}

/**
 * Multi-field product search for invoice/quotation line items.
 *
 * Combines a free-text part-number/description query with optional category
 * and model filters (all AND-combined server-side) and returns the matching
 * parts. Category/model suggestion lists are loaded once for autocomplete.
 */
export function useProductSearch(config: UseProductSearchOptions = {}) {
  const { limit = 25 } = config;

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [model, setModel] = useState('');

  const [results, setResults] = useState<ProductSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  // Load distinct category/model values once for the autocomplete suggestions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catResult, modelResult] = await Promise.all([
          window.electron.invoke(IpcChannel.GET_DISTINCT_CATEGORIES, { limit: 200 }),
          window.electron.invoke(IpcChannel.GET_DISTINCT_MODELS, { limit: 200 }),
        ]);
        if (cancelled) return;
        if (catResult?.success && Array.isArray(catResult.data)) {
          setCategoryOptions(catResult.data);
        }
        if (modelResult?.success && Array.isArray(modelResult.data)) {
          setModelOptions(modelResult.data);
        }
      } catch (error) {
        console.error('Failed to load category/model options:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search whenever any active filter changes.
  useEffect(() => {
    const q = query.trim();
    const cat = category.trim();
    const mdl = model.trim();

    // Need a text query of >= 2 chars, or a category/model filter, to search.
    if (q.length < 2 && !cat && !mdl) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.SEARCH_INVENTORY_WITH_VARIANTS, {
          query: q,
          category: cat || undefined,
          model: mdl || undefined,
          limit,
        });
        if (cancelled) return;
        if (result.success && Array.isArray(result.data)) {
          setResults(result.data);
        } else {
          setResults([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to search products:', error);
          setResults([]);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, category, model, limit]);

  const clear = useCallback(() => {
    setQuery('');
    setCategory('');
    setModel('');
    setResults([]);
  }, []);

  return {
    query,
    setQuery,
    category,
    setCategory,
    model,
    setModel,
    results,
    isSearching,
    categoryOptions,
    modelOptions,
    clear,
  };
}
