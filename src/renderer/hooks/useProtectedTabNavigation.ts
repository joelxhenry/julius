import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useAuth, SafeEmployee } from '../contexts/AuthContext';
import { useTabContext } from '../contexts/TabContext';
import { useNavigationMenu } from '../contexts/NavigationMenuContext';
import { isPublicRoute, getRoutePermission, getRouteDescription } from '../router/permissions';
import { getComponentForPath } from '../utils/componentMapper';

type ModifierEvent = Pick<React.MouseEvent, 'ctrlKey' | 'metaKey'>;

/**
 * Browser-like protected navigation for global entry points (sidebar, keyboard
 * shortcuts, spotlight search, landing page quick actions): plain click/call
 * replaces the current tab, Ctrl/Cmd+click or the right-click "Open in new
 * tab" menu opens a new tab instead. Also gates navigation behind PIN
 * verification and permission checks, same as before this hook existed.
 */
export function useProtectedTabNavigation() {
  const navigate = useNavigate();
  const { isSessionValid, hasPermission } = useAuth();
  const { replaceCurrentTab, openTab, isTabbed } = useTabContext();
  const { requestMenu } = useNavigationMenu();

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [pendingNavigationNewTab, setPendingNavigationNewTab] = useState(false);
  const [requiredPermission, setRequiredPermission] = useState<string | undefined>(undefined);

  const openTabbedRoute = useCallback(
    (path: string, newTab: boolean) => {
      if (newTab) {
        openTab(path, getComponentForPath(path));
      } else {
        replaceCurrentTab(path);
      }
    },
    [openTab, replaceCurrentTab]
  );

  const navigateTo = useCallback(
    (path: string, event?: ModifierEvent) => {
      const newTab = Boolean(event?.ctrlKey || event?.metaKey);

      if (isPublicRoute(path)) {
        navigate(path);
        return;
      }

      const permission = getRoutePermission(path);

      if (permission === undefined) {
        navigate(path);
        return;
      }

      if (isSessionValid) {
        if (permission === null || hasPermission(permission)) {
          if (isTabbed(path)) {
            openTabbedRoute(path, newTab);
          } else {
            navigate(path);
          }
          return;
        }

        notifications.show({
          title: 'Access Denied',
          message: `You do not have permission to access ${getRouteDescription(path)}`,
          color: 'red',
        });
        return;
      }

      // Need PIN verification
      setPendingNavigation(path);
      setPendingNavigationNewTab(newTab);
      setRequiredPermission(permission ?? undefined);
      setPinModalOpen(true);
    },
    [isSessionValid, hasPermission, navigate, isTabbed, openTabbedRoute]
  );

  const bind = useCallback(
    (path: string | undefined) => ({
      onClick: (e: React.MouseEvent) => {
        if (!path) return;
        navigateTo(path, e);
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (!path || !isTabbed(path)) return;
        e.preventDefault();
        e.stopPropagation();
        requestMenu(e.clientX, e.clientY, path);
      },
    }),
    [navigateTo, isTabbed, requestMenu]
  );

  const handlePinVerified = useCallback(
    (_employee: SafeEmployee) => {
      if (pendingNavigation) {
        if (isTabbed(pendingNavigation)) {
          openTabbedRoute(pendingNavigation, pendingNavigationNewTab);
        } else {
          navigate(pendingNavigation);
        }
        setPendingNavigation(null);
        setPendingNavigationNewTab(false);
      }
      setPinModalOpen(false);
      setRequiredPermission(undefined);
    },
    [pendingNavigation, pendingNavigationNewTab, isTabbed, openTabbedRoute, navigate]
  );

  const handlePinModalClose = useCallback(() => {
    setPinModalOpen(false);
    setPendingNavigation(null);
    setPendingNavigationNewTab(false);
    setRequiredPermission(undefined);
  }, []);

  // Lets a caller (e.g. a location-change guard) force the PIN modal open for
  // a path that's already been navigated to by some other means, without
  // going through the click/ctrl-click/right-click decision in navigateTo.
  const requirePinFor = useCallback((path: string) => {
    const permission = getRoutePermission(path);
    setPendingNavigation(path);
    setPendingNavigationNewTab(false);
    setRequiredPermission(permission ?? undefined);
    setPinModalOpen(true);
  }, []);

  return {
    navigateTo,
    bind,
    pinModalOpen,
    pendingNavigation,
    requiredPermission,
    handlePinVerified,
    handlePinModalClose,
    requirePinFor,
  };
}
