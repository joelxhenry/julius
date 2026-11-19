import { useState, useCallback, useRef } from 'react';

// Module-level store (not component state) so values outlive the component:
// list pages are regenerated from scratch (see getComponentForPath in
// TabContext) whenever a tab navigates away and back, which would otherwise
// reset every search box, filter, and loaded page back to its default.
const cache = new Map<string, unknown>();

// Drop-in replacement for useState that mirrors its value into the shared
// cache under `key`, so the next mount of a component using the same key
// picks up where the last one left off.
export function useListState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() =>
    cache.has(key) ? (cache.get(key) as T) : initialValue instanceof Function ? initialValue() : initialValue
  );

  const setPersisted = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = value instanceof Function ? (value as (prev: T) => T)(prev) : value;
        cache.set(key, next);
        return next;
      });
    },
    [key]
  );

  return [state, setPersisted];
}

// Whether `key` already holds a cached value right now — use this to pick a
// sensible initial value for things like a loading flag (false when we're
// about to restore data instead of fetching it for the first time).
export function wasPersisted(key: string): boolean {
  return cache.has(key);
}

// Stable function reporting true exactly once per mount — on its first call —
// when `key` already held a cached value, i.e. this mount is restoring prior
// state rather than starting fresh. Lets a "(re)fetch on mount" effect skip a
// redundant fetch when results were already restored from the cache.
export function useRestoreGuard(key: string): () => boolean {
  const ref = useRef(cache.has(key));
  return useCallback(() => {
    if (ref.current) {
      ref.current = false;
      return true;
    }
    return false;
  }, []);
}

// Clears cached list state, e.g. on logout so the next employee doesn't see
// the previous one's filters. Omit `prefix` to clear everything.
export function clearListState(prefix?: string) {
  if (prefix === undefined) {
    cache.clear();
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) cache.delete(k);
  }
}
