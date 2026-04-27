import { useEffect, useState, useCallback, useRef } from 'react';
import { AppShell, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TabBar } from '../components/layout/TabBar';
import { TabContainer } from '../components/layout/TabContainer';
import { PinVerificationModal } from '../components/auth/PinVerificationModal';
import { Spotlight } from '../components/common/Spotlight';
import { MarkedItemsLauncher } from '../components/tray/MarkedItemsLauncher';
import { MarkedItemsTray } from '../components/tray/MarkedItemsTray';
import { useTheme } from '../contexts/ThemeContext';
import { useKeyboardShortcutContext } from '../contexts/KeyboardShortcutContext';
import { SpotlightProvider } from '../contexts/SpotlightContext';
import { TabProvider, useTabContext } from '../contexts/TabContext';
import { useAuth, SafeEmployee } from '../contexts/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { isPublicRoute, getRoutePermission, getRouteDescription } from '../router/permissions';
import { getComponentForPath } from '../utils/componentMapper';

// Global navigation shortcuts
const navigationShortcuts = [
  { key: 'h', path: '/', description: 'Home' },
  { key: 'i', path: '/invoices/form', description: 'Create Invoice' },
  { key: 'q', path: '/quotations/new', description: 'Create Quotation' },
  { key: 's', path: '/inventory', description: 'Search Inventory' },
  { key: 'p', path: '/payments', description: 'Process Payments' },
  { key: 'c', path: '/attendance', description: 'Clock In/Out' },
  { key: 'd', path: '/dashboard', description: 'Dashboard' },
];

function AppLayoutContent() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [trayOpened, { open: openTray, close: closeTray }] = useDisclosure(false);
  const { colorScheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { registerShortcuts, unregisterShortcuts } = useKeyboardShortcutContext();
  const { isSessionValid, hasPermission } = useAuth();
  const { tabs, openTab, isTabbed, closeCurrentTab, nextTab, previousTab, selectTabByIndex } = useTabContext();

  // Initialize idle timeout tracking
  useIdleTimeout();

  const isDark = colorScheme === 'dark';

  // PIN verification modal state
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [requiredPermission, setRequiredPermission] = useState<string | undefined>(undefined);
  const previousPathRef = useRef<string>(location.pathname);

  // Handle navigation with PIN verification
  const handleProtectedNavigation = useCallback(
    (path: string) => {
     
       // Public routes don't need authentication
      if (isPublicRoute(path)) {
        navigate(path);
        return;
      }

      const permission = getRoutePermission(path);

       // Public routes don't need authentication
      if (permission === undefined) {
        navigate(path);
        return;
      }

      // Check if user has valid session
      if (isSessionValid) {
        // Session is valid, check permission if required
        if (permission === null || hasPermission(permission)) {
          // Check if this route should be tabbed
          if (isTabbed(path)) {
            // Create component and open in tab
            const component = getComponentForPath(path);
            openTab(path, component);
          } else {
            // Non-tabbed route, use regular navigation
            navigate(path);
          }
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
    [isSessionValid, hasPermission, navigate, isTabbed, openTab]
  );

  // Handle successful PIN verification
  const handlePinVerified = useCallback(
    (employee: SafeEmployee) => {
      if (pendingNavigation) {
        // Check if this route should be tabbed
        if (isTabbed(pendingNavigation)) {
          const component = getComponentForPath(pendingNavigation);
          openTab(pendingNavigation, component);
        } else {
          navigate(pendingNavigation);
        }
        setPendingNavigation(null);
      }
      setPinModalOpen(false);
      setRequiredPermission(undefined);
    },
    [pendingNavigation, navigate, isTabbed, openTab]
  );

  // Handle PIN modal close (cancelled)
  const handlePinModalClose = useCallback(() => {
    setPinModalOpen(false);
    setPendingNavigation(null);
    setRequiredPermission(undefined);
    // Navigate back to previous path if we were trying to access a protected route
    if (pendingNavigation && !isPublicRoute(location.pathname)) {
      navigate(previousPathRef.current);
    }
  }, [pendingNavigation, location.pathname, navigate]);

  // Track previous path
  useEffect(() => {
    if (isPublicRoute(location.pathname) || isSessionValid) {
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname, isSessionValid]);

  // Check route access on location change
  useEffect(() => {
    const path = location.pathname;

    // Skip if public route
    if (isPublicRoute(path)) {
      return;
    }

    // Check if session is valid for protected routes
    if (!isSessionValid) {
      const permission = getRoutePermission(path);
      setPendingNavigation(path);
      setRequiredPermission(permission ?? undefined);
      setPinModalOpen(true);
    }
  }, [location.pathname, isSessionValid]);

  // Register global navigation shortcuts with PIN verification
  useEffect(() => {
    const shortcuts: KeyboardShortcut[] = navigationShortcuts.map((item) => ({
      key: item.key,
      alt: true,
      callback: () => handleProtectedNavigation(item.path),
      description: item.description,
    }));

    registerShortcuts('navigation', shortcuts);

    return () => {
      unregisterShortcuts('navigation');
    };
  }, [handleProtectedNavigation, registerShortcuts, unregisterShortcuts]);

  // Register tray keyboard shortcut (Q-B9: Shift+2 / @)
  useEffect(() => {
    const trayShortcuts: KeyboardShortcut[] = [
      {
        key: '@',
        shift: true,
        callback: () => {
          if (trayOpened) {
            closeTray();
          } else {
            openTray();
          }
        },
        description: 'Toggle marked items tray',
      },
    ];
    registerShortcuts('marked-items', trayShortcuts);
    return () => {
      unregisterShortcuts('marked-items');
    };
  }, [trayOpened, openTray, closeTray, registerShortcuts, unregisterShortcuts]);

  // Register tab keyboard shortcuts
  useEffect(() => {
    const tabShortcuts: KeyboardShortcut[] = [
      {
        key: 'w',
        ctrl: true,
        callback: closeCurrentTab,
        description: 'Close current tab',
      },
      {
        key: 'Tab',
        ctrl: true,
        callback: (e) => {
          e?.preventDefault();
          nextTab();
        },
        description: 'Next tab',
      },
      {
        key: 'Tab',
        ctrl: true,
        shift: true,
        callback: (e) => {
          e?.preventDefault();
          previousTab();
        },
        description: 'Previous tab',
      },
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        ctrl: true,
        callback: () => selectTabByIndex(i),
        description: `Switch to tab ${i + 1}`,
      })),
    ];

    registerShortcuts('tabs', tabShortcuts);

    return () => {
      unregisterShortcuts('tabs');
    };
  }, [closeCurrentTab, nextTab, previousTab, selectTabByIndex, registerShortcuts, unregisterShortcuts]);

  return (
    <SpotlightProvider onNavigate={handleProtectedNavigation}>
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
        }}
        padding={0}
        styles={{
          root: {
            transition: 'background-color 200ms ease',
          },
          main: {
            background: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-0)',
            transition: 'background-color 200ms ease',
          },
        }}
      >
        <AppShell.Header
          style={{
            background: 'var(--mantine-color-body)',
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <Header
            desktopOpened={desktopOpened}
            mobileOpened={mobileOpened}
            onToggleDesktop={toggleDesktop}
            onToggleMobile={toggleMobile}
          />
        </AppShell.Header>

        <AppShell.Navbar
          p={0}
          style={{
            background: 'var(--mantine-color-body)',
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <Sidebar onNavigate={handleProtectedNavigation} />
        </AppShell.Navbar>

        <AppShell.Main
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            transition: 'background-color 200ms ease',
          }}
        >
          <TabBar />

          {/* Show TabContainer when tabs exist AND we're on a tabbed route */}
          {tabs.length > 0 && isTabbed(location.pathname) && (
            <TabContainer />
          )}

          {/* Show Outlet when on non-tabbed routes OR when no tabs exist */}
          {(!isTabbed(location.pathname) || tabs.length === 0) && (
            <Box
              style={{
                flex: 1,
                overflow: 'auto',
                padding: 'var(--mantine-spacing-md)',
                background: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-0)',
                transition: 'background-color 200ms ease',
              }}
            >
              <Outlet />
            </Box>
          )}
        </AppShell.Main>
      </AppShell>

      <Spotlight />

      {isSessionValid && (
        <>
          <MarkedItemsLauncher onOpen={openTray} />
          <MarkedItemsTray opened={trayOpened} onClose={closeTray} />
        </>
      )}

      <PinVerificationModal
        opened={pinModalOpen}
        onClose={handlePinModalClose}
        onVerified={handlePinVerified}
        requiredPermission={requiredPermission}
        title="Authentication Required"
        description={`Enter your PIN to access ${pendingNavigation ? getRouteDescription(pendingNavigation) : 'this feature'}`}
      />
    </SpotlightProvider>
  );
}

export function AppLayout() {
  return (
    <TabProvider getComponentForPath={getComponentForPath}>
      <AppLayoutContent />
    </TabProvider>
  );
}
