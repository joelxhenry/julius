import { useEffect, useCallback, useRef } from 'react';
import { AppShell, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { TabBar } from '../components/layout/TabBar';
import { TabContainer } from '../components/layout/TabContainer';
import { PinVerificationModal } from '../components/auth/PinVerificationModal';
import { Spotlight } from '../components/common/Spotlight';
import { MarkedItemsTray } from '../components/tray/MarkedItemsTray';
import { useTheme } from '../contexts/ThemeContext';
import { useKeyboardShortcutContext } from '../contexts/KeyboardShortcutContext';
import { SpotlightProvider } from '../contexts/SpotlightContext';
import { TabProvider, useTabContext } from '../contexts/TabContext';
import { NavigationMenuProvider } from '../contexts/NavigationMenuContext';
import { useAuth } from '../contexts/AuthContext';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { useProtectedTabNavigation } from '../hooks/useProtectedTabNavigation';
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
  const { tabs, isTabbed, closeCurrentTab, nextTab, previousTab, selectTabByIndex } = useTabContext();
  const {
    navigateTo,
    bind,
    pinModalOpen,
    pendingNavigation,
    requiredPermission,
    handlePinVerified,
    handlePinModalClose: closePinModal,
    requirePinFor,
  } = useProtectedTabNavigation();

  // Initialize idle timeout tracking
  useIdleTimeout();

  const isDark = colorScheme === 'dark';

  const previousPathRef = useRef<string>(location.pathname);

  // Handle PIN modal close (cancelled): navigate back to the previous path
  // if we were trying to access a protected route reached by URL/location
  // change (browser back/forward, direct link) rather than a click.
  const handlePinModalClose = useCallback(() => {
    const hadPending = pendingNavigation;
    closePinModal();
    if (hadPending && !isPublicRoute(location.pathname)) {
      navigate(previousPathRef.current);
    }
  }, [pendingNavigation, closePinModal, location.pathname, navigate]);

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
      requirePinFor(path);
    }
  }, [location.pathname, isSessionValid, requirePinFor]);

  // Register global navigation shortcuts with PIN verification.
  // Skip shortcuts for features the user can't access so the hidden page's
  // shortcut is a no-op rather than triggering an "Access Denied" block.
  useEffect(() => {
    const shortcuts: KeyboardShortcut[] = navigationShortcuts
      .filter((item) => {
        const permission = getRoutePermission(item.path);
        return !permission || hasPermission(permission);
      })
      .map((item) => ({
        key: item.key,
        alt: true,
        callback: () => navigateTo(item.path),
        description: item.description,
      }));

    registerShortcuts('navigation', shortcuts);

    return () => {
      unregisterShortcuts('navigation');
    };
  }, [navigateTo, hasPermission, registerShortcuts, unregisterShortcuts]);

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
    <SpotlightProvider onNavigate={navigateTo}>
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
            onOpenTray={openTray}
          />
        </AppShell.Header>

        <AppShell.Navbar
          p={0}
          style={{
            background: 'var(--mantine-color-body)',
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          <Sidebar onNavigate={navigateTo} bind={bind} />
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
        <MarkedItemsTray opened={trayOpened} onClose={closeTray} />
      )}

      <PinVerificationModal
        opened={pinModalOpen}
        onClose={handlePinModalClose}
        onVerified={handlePinVerified}
        requiredPermission={requiredPermission}
        title="Authentication Required"
        description={`Search for your name and enter your password to access ${pendingNavigation ? getRouteDescription(pendingNavigation) : 'this feature'}`}
      />
    </SpotlightProvider>
  );
}

export function AppLayout() {
  return (
    <TabProvider getComponentForPath={getComponentForPath}>
      <NavigationMenuProvider>
        <AppLayoutContent />
      </NavigationMenuProvider>
    </TabProvider>
  );
}
