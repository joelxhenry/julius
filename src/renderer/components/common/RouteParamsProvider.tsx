import { useMemo } from 'react';
import { useLocation, matchPath } from 'react-router-dom';

interface RouteParamsProviderProps {
  children: React.ReactNode;
  path: string;
}

/**
 * Wrapper component that makes route parameters available to children
 * even when rendered outside of React Router's <Outlet />
 *
 * This is needed for the tab system where components are rendered directly
 * but still need access to useParams() and useLocation()
 */
export function RouteParamsProvider({ children, path }: RouteParamsProviderProps) {
  // The children components will use useParams() and useLocation() which work
  // because they're still under the React Router provider, and the URL is
  // updated when tabs switch

  // This component is just a passthrough - React Router's hooks work
  // because we update the URL with window.history.replaceState()
  return <>{children}</>;
}
