import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { notifications } from '@mantine/notifications';

export interface MarkedItem {
  key: string;
  partNumber: string;
  description: string;
  unitPrice: number;
  isTaxable: boolean;
  isVariant: boolean;
  parentPartNumber?: string | null;
  inventoryId?: number;
  quantity: number;
  markedAt: number;
}

export type MarkInput = Omit<MarkedItem, 'markedAt' | 'quantity'> & {
  quantity?: number;
};

export type DraftDocType = 'invoice' | 'quotation';

export interface DraftHandler {
  docType: DraftDocType;
  label: string;
  /** The path of the tab/page that owns this handler, for tab-switching after append. */
  path: string;
  append: (items: MarkedItem[]) => void | Promise<void>;
}

interface MarkedItemsContextValue {
  items: MarkedItem[];
  count: number;
  mark: (item: MarkInput) => void;
  unmark: (key: string) => void;
  setQuantity: (key: string, qty: number) => void;
  clear: () => void;
  isMarked: (key: string) => boolean;
  consume: () => MarkedItem[];
  /** Drain only the entries whose key is in `keys`. Order preserves insertion order. */
  consumeKeys: (keys: string[]) => MarkedItem[];
  draftHandler: DraftHandler | null;
  registerDraftHandler: (handler: DraftHandler) => () => void;
}

const MarkedItemsContext = createContext<MarkedItemsContextValue | undefined>(undefined);

const STORAGE_KEY = 'turbo-julius-marked-items';

function loadFromSessionStorage(): MarkedItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is MarkedItem =>
        entry &&
        typeof entry === 'object' &&
        typeof entry.key === 'string' &&
        typeof entry.partNumber === 'string'
    );
  } catch (error) {
    console.error('Failed to load marked items from sessionStorage:', error);
    return [];
  }
}

export function MarkedItemsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MarkedItem[]>(() => loadFromSessionStorage());
  const [draftHandler, setDraftHandler] = useState<DraftHandler | null>(null);

  // Keep a ref in sync so consume() can return a non-stale snapshot regardless of closure age.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Mirror to sessionStorage on every change (Q-B2).
  useEffect(() => {
    try {
      if (items.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (error) {
      console.error('Failed to mirror marked items to sessionStorage:', error);
    }
  }, [items]);

  const isMarked = useCallback(
    (key: string) => items.some((entry) => entry.key === key),
    [items]
  );

  const mark = useCallback((item: MarkInput) => {
    setItems((prev) => {
      if (prev.some((entry) => entry.key === item.key)) {
        // Q-B4: duplicate mark is a no-op with user feedback.
        notifications.show({
          title: 'Already in tray',
          message: `${item.partNumber} is already marked.`,
          color: 'yellow',
        });
        return prev;
      }
      const next: MarkedItem = {
        ...item,
        quantity: item.quantity ?? 1,
        markedAt: Date.now(),
      };
      return [...prev, next];
    });
  }, []);

  const unmark = useCallback((key: string) => {
    setItems((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const setQuantity = useCallback((key: string, qty: number) => {
    const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    setItems((prev) =>
      prev.map((entry) => (entry.key === key ? { ...entry, quantity: safeQty } : entry))
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const consume = useCallback((): MarkedItem[] => {
    const snapshot = itemsRef.current;
    setItems([]);
    return snapshot;
  }, []);

  const consumeKeys = useCallback((keys: string[]): MarkedItem[] => {
    if (keys.length === 0) return [];
    const keySet = new Set(keys);
    const taken = itemsRef.current.filter((entry) => keySet.has(entry.key));
    if (taken.length === 0) return [];
    setItems((prev) => prev.filter((entry) => !keySet.has(entry.key)));
    return taken;
  }, []);

  const registerDraftHandler = useCallback((handler: DraftHandler) => {
    setDraftHandler(handler);
    return () => {
      // Only deregister if this is still the registered handler — guards against
      // out-of-order unmounts when another page registered after this one.
      setDraftHandler((current) => (current === handler ? null : current));
    };
  }, []);

  const value = useMemo<MarkedItemsContextValue>(
    () => ({
      items,
      count: items.length,
      mark,
      unmark,
      setQuantity,
      clear,
      isMarked,
      consume,
      consumeKeys,
      draftHandler,
      registerDraftHandler,
    }),
    [items, mark, unmark, setQuantity, clear, isMarked, consume, consumeKeys, draftHandler, registerDraftHandler]
  );

  return (
    <MarkedItemsContext.Provider value={value}>{children}</MarkedItemsContext.Provider>
  );
}

export function useMarkedItemsContext() {
  const ctx = useContext(MarkedItemsContext);
  if (ctx === undefined) {
    throw new Error('useMarkedItemsContext must be used within a MarkedItemsProvider');
  }
  return ctx;
}
