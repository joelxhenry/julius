import { useParams } from 'react-router-dom';

/**
 * Custom hook that works with both regular routes and the tab system
 * Falls back to reading params from data attributes when router context is not available
 */
export function useTabParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): Readonly<Partial<T>> {
  const params = useParams();

  // If we have params from router, use them
  if (Object.keys(params).length > 0) {
    return params as Partial<T>;
  }

  // Otherwise, try to read from tab container's data attribute
  try {
    const element = document.querySelector('[data-route-params]');
    if (element) {
      const dataParams = element.getAttribute('data-route-params');
      if (dataParams) {
        return JSON.parse(dataParams) as Partial<T>;
      }
    }
  } catch (error) {
    console.error('Failed to parse route params from data attribute:', error);
  }

  return {} as Partial<T>;
}
