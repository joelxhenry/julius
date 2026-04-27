import { useMarkedItemsContext } from '../contexts/MarkedItemsContext';

export type { MarkedItem, MarkInput, DraftHandler, DraftDocType } from '../contexts/MarkedItemsContext';

export function useMarkedItems() {
  return useMarkedItemsContext();
}
