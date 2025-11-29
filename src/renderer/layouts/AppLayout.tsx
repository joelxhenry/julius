import { AppShell, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { GlobalKeyboardShortcuts } from '../components/common/GlobalKeyboardShortcuts';
import { CommandPalette } from '../components/common/CommandPalette';
import { SearchSpotlight } from '../components/common/SearchSpotlight';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { TabBar } from '../components/tabs/TabBar';
import { TabContainer } from '../components/tabs/TabContainer';
import { useTheme } from '../contexts/ThemeContext';

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [spotlightOpened, setSpotlightOpened] = useState(false);
  const [stockAdjustmentOpened, setStockAdjustmentOpened] = useState(false);
  const [searchOpened, setSearchOpened] = useState(false);
  const { colorScheme } = useTheme();

  const isDark = colorScheme === 'dark';

  return (
    <>
      <GlobalKeyboardShortcuts
        onOpenSpotlight={() => setSpotlightOpened(true)}
        onOpenStockAdjustment={() => setStockAdjustmentOpened(true)}
        onOpenSearch={() => setSearchOpened(true)}
      />
      <CommandPalette opened={spotlightOpened} onClose={() => setSpotlightOpened(false)} />
      <SearchSpotlight opened={searchOpened} onClose={() => setSearchOpened(false)} />
      <StockAdjustmentModal opened={stockAdjustmentOpened} onClose={() => setStockAdjustmentOpened(false)} />

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
              position: 'relative',
              borderBottom: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-body)',
              transition: 'background-color 200ms ease, border-color 200ms ease',
            }}
          >
            <TabBar />
          </Box>
          <Box
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 'var(--mantine-spacing-md)',
              background: isDark ? 'var(--mantine-color-dark-8)' : 'var(--mantine-color-gray-0)',
              transition: 'background-color 200ms ease',
            }}
          >
            <TabContainer />
          </Box>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
