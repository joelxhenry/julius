import { AppShell, Stack, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { GlobalKeyboardShortcuts } from '../components/common/GlobalKeyboardShortcuts';
import { CommandPalette } from '../components/common/CommandPalette';
import { TabBar } from '../components/tabs/TabBar';
import { TabContainer } from '../components/tabs/TabContainer';

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);
  const [spotlightOpened, setSpotlightOpened] = useState(false);

  return (
    <>
      <GlobalKeyboardShortcuts onOpenSpotlight={() => setSpotlightOpened(true)} />
      <CommandPalette opened={spotlightOpened} onClose={() => setSpotlightOpened(false)} />

      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 250,
          breakpoint: 'sm',
          collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
        }}
        padding={0}
      >
        <AppShell.Header>
          <Header />
        </AppShell.Header>

        <AppShell.Navbar>
          <Sidebar />
        </AppShell.Navbar>

        <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <Box style={{ position: 'relative' }}>
            <TabBar />
          </Box>
          <Box style={{ flex: 1, overflow: 'hidden', padding: 'var(--mantine-spacing-md)' }}>
            <TabContainer />
          </Box>
        </AppShell.Main>
      </AppShell>
    </>
  );
}
