import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth, SafeEmployee } from '../contexts/AuthContext';
import { isPublicRoute, getRoutePermission, getRouteDescription } from '../router/permissions';

interface UseProtectedNavigationReturn {
  navigateTo: (path: string) => void;
  pinModalOpen: boolean;
  pendingNavigation: string | null;
  requiredPermission: string | undefined;
  handlePinVerified: (employee: SafeEmployee) => void;
  handlePinModalClose: () => void;
}

/**
 * Hook that provides protected navigation with PIN verification
 * Use this in components that need to navigate to protected routes
 */
export function useProtectedNavigation(): UseProtectedNavigationReturn {
  const navigate = useNavigate();
  const { isSessionValid, hasPermission } = useAuth();

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [requiredPermission, setRequiredPermission] = useState<string | undefined>(undefined);

  const navigateTo = useCallback(
    (path: string) => {
      // Public routes don't need authentication
      if (isPublicRoute(path)) {
        navigate(path);
        return;
      }

      const permission = getRoutePermission(path);

      // Check if user has valid session
      if (isSessionValid) {
        // Session is valid, check permission if required
        if (permission === null || hasPermission(permission)) {
          navigate(path);
          return;
        } else {
          // Has session but lacks permission
          notifications.show({
            title: 'Access Denied',
            message: `You do not have permission to access ${getRouteDescription(path)}`,
            color: 'red',
          });
          return;
        }
      }

      // Need PIN verification
      setPendingNavigation(path);
      setRequiredPermission(permission ?? undefined);
      setPinModalOpen(true);
    },
    [isSessionValid, hasPermission, navigate]
  );

  const handlePinVerified = useCallback(
    (employee: SafeEmployee) => {
      if (pendingNavigation) {
        navigate(pendingNavigation);
        setPendingNavigation(null);
      }
      setPinModalOpen(false);
      setRequiredPermission(undefined);
    },
    [pendingNavigation, navigate]
  );

  const handlePinModalClose = useCallback(() => {
    setPinModalOpen(false);
    setPendingNavigation(null);
    setRequiredPermission(undefined);
  }, []);

  return {
    navigateTo,
    pinModalOpen,
    pendingNavigation,
    requiredPermission,
    handlePinVerified,
    handlePinModalClose,
  };
}
