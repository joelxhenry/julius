import { AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { GlobalKeyboardShortcuts } from '../components/common/GlobalKeyboardShortcuts';
import { CommandPalette } from '../components/common/CommandPalette';

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
        padding="md"
      >
        <AppShell.Header>
          <Header />
        </AppShell.Header>

        <AppShell.Navbar>
          <Sidebar />
        </AppShell.Navbar>

        <AppShell.Main>
          <Outlet />
        </AppShell.Main>
      </AppShell>
    </>
  );
}
