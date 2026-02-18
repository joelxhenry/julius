import { useParams, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { matchPath } from 'react-router-dom';
import { useTabPath } from '../components/layout/TabContainer';

/**
 * Custom hook that works with both regular routes and the tab system
 * Extracts params directly from the tab's path (not the global location)
 */
export function useTabParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): Readonly<Partial<T>> {
  const params = useParams();
  const location = useLocation();
  const tabPath = useTabPath(); // Get the tab-specific path from context

  return useMemo(() => {
    // IMPORTANT: If we're in a tab (tabPath exists), ignore router params completely
    // Router params are global and will cause cross-tab interference
    const pathToMatch = tabPath || location.pathname;

    // Only use router params if we're NOT in a tab
    if (!tabPath && Object.keys(params).length > 0) {
      return params as Partial<T>;
    }

    // If we're in a tab (tabPath exists) but location changes, ignore location changes
    // This prevents cross-tab interference
    if (tabPath && tabPath !== location.pathname) {
      // We're in a tab, use only the tab's path, ignore global location
      console.log('[useTabParams] Using tabPath:', tabPath, 'ignoring location:', location.pathname);
    }

    // Otherwise, try to match the path against known patterns
    // IMPORTANT: More specific patterns must come before generic ones
    // e.g., /invoices/form/:id must come before /invoices/:id
    const routePatterns = [
      '/invoices/form/:id',
      '/invoices/edit/:id',
      '/invoices/:id',
      '/quotations/:id/edit',
      '/quotations/:id',
      '/inventory/:id/edit',
      '/inventory/:id',
      '/payments/:id',
      '/credit-notes/:id',
      '/employees/:id/edit',
      '/employees/:id/permissions',
      '/employees/:id',
      '/clients/:id/edit',
      '/clients/:id',
      '/suppliers/:id/edit',
      '/suppliers/:id',
    ];

    for (const pattern of routePatterns) {
      const match = matchPath(pattern, pathToMatch);
      if (match) {
        return match.params as Partial<T>;
      }
    }

    return {} as Partial<T>;
  }, [params, tabPath]);
}
