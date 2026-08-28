import { useEffect, useMemo, useState } from 'react';
import { IpcChannel } from '../../shared/types/ipc';

export interface PartLabel {
  category: string | null;
  model: string | null;
}

/**
 * Resolve category + model labels for a set of part SKUs (variant SKUs inherit
 * their parent's labels). Returns a map keyed by SKU. Refetches only when the
 * distinct set of SKUs changes, so it is cheap to call from a line-items table
 * that re-renders on every keystroke.
 */
export function usePartLabels(skus: Array<string | null | undefined>): Record<string, PartLabel> {
  const [labels, setLabels] = useState<Record<string, PartLabel>>({});

  // Distinct, sorted SKU list plus a stable string key. The key drives the
  // effect so it only refetches when the underlying set actually changes.
  const { list, key } = useMemo(() => {
    const unique = Array.from(new Set(skus.filter((s): s is string => !!s)));
    unique.sort();
    return { list: unique, key: JSON.stringify(unique) };
  }, [skus]);

  useEffect(() => {
    if (list.length === 0) {
      setLabels({});
      return;
    }

    let cancelled = false;
    window.electron
      .invoke(IpcChannel.GET_PART_LABELS_BY_SKUS, { skus: list })
      .then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const map: Record<string, PartLabel> = {};
          for (const row of res.data as Array<{ sku: string; category: string | null; model: string | null }>) {
            map[row.sku] = { category: row.category, model: row.model };
          }
          setLabels(map);
        }
      })
      .catch((error) => {
        console.error('Failed to load part labels:', error);
      });

    return () => {
      cancelled = true;
    };
    // `list` is derived from `key`; depending on `key` avoids refetching on
    // every render while staying in sync with the SKU set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return labels;
}
