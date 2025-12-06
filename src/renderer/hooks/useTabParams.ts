import { useParams, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { matchPath } from 'react-router-dom';

/**
 * Custom hook that works with both regular routes and the tab system
 * Extracts params directly from the location path
 */
export function useTabParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): Readonly<Partial<T>> {
  const params = useParams();
  const location = useLocation();

  return useMemo(() => {
    // If we have params from router, use them
    if (Object.keys(params).length > 0) {
      return params as Partial<T>;
    }

    // Otherwise, try to match the location path against known patterns
    const routePatterns = [
      '/invoices/:id',
      '/invoices/:id/edit',
      '/quotations/:id',
      '/quotations/:id/edit',
      '/inventory/:id',
      '/inventory/:id/edit',
      '/payments/:id',
      '/employees/:id',
      '/employees/:id/edit',
      '/employees/:id/permissions',
      '/clients/:id',
      '/clients/:id/edit',
    ];

    for (const pattern of routePatterns) {
      const match = matchPath(pattern, location.pathname);
      if (match) {
        return match.params as Partial<T>;
      }
    }

    return {} as Partial<T>;
  }, [params, location.pathname]);
}
