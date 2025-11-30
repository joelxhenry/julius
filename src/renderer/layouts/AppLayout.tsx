import { useEffect } from 'react';
import { AppShell, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { useTheme } from '../contexts/ThemeContext';
import { useKeyboardShortcutContext } from '../contexts/KeyboardShortcutContext';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

// Global navigation shortcuts
const navigationShortcuts = [
  { key: 'h', path: '/', description: 'Home' },
  { key: 'i', path: '/invoices/new', description: 'Create Invoice' },
  { key: 'q', path: '/quotations/new', description: 'Create Quotation' },
  { key: 's', path: '/inventory', description: 'Search Inventory' },
  { key: 'f', path: '/invoices', description: 'Search Invoices' },
  { key: 'p', path: '/payments', description: 'Process Payments' },
  { key: 'c', path: '/attendance', description: 'Clock In/Out' },
  { key: 'd', path: '/dashboard', description: 'Dashboard' },
];

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const { colorScheme } = useTheme();
  const navigate = useNavigate();
  const { registerShortcuts, unregisterShortcuts } = useKeyboardShortcutContext();

  const isDark = colorScheme === 'dark';

  // Register global navigation shortcuts
  useEffect(() => {
    const shortcuts: KeyboardShortcut[] = navigationShortcuts.map((item) => ({
      key: item.key,
      alt: true,
      callback: () => navigate(item.path),
      description: item.description,
    }));

    registerShortcuts('navigation', shortcuts);

    return () => {
      unregisterShortcuts('navigation');
    };
  }, [navigate, registerShortcuts, unregisterShortcuts]);

  return (
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
        <Header />
      </AppShell.Header>

      <AppShell.Navbar
        p={0}
        style={{
          background: 'var(--mantine-color-body)',
          transition: 'background-color 200ms ease, border-color 200ms ease',
        }}
      >
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          transition: 'background-color 200ms ease',
        }}
      >
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
      </AppShell.Main>
    </AppShell>
  );
}
