import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Paper, Stack, UnstyledButton, Group, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useClickOutside } from '@mantine/hooks';
import { useTabContext } from './TabContext';

interface MenuState {
  x: number;
  y: number;
  path: string;
}

interface NavigationMenuContextValue {
  requestMenu: (x: number, y: number, path: string) => void;
}

const NavigationMenuContext = createContext<NavigationMenuContextValue | undefined>(undefined);

export function useNavigationMenu() {
  const context = useContext(NavigationMenuContext);
  if (context === undefined) {
    throw new Error('useNavigationMenu must be used within a NavigationMenuProvider');
  }
  return context;
}

function NavigationContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState;
  onClose: () => void;
}) {
  const { openTab } = useTabContext();
  const ref = useClickOutside(onClose);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleDismiss = () => onClose();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', handleDismiss);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [onClose]);

  return (
    <Paper
      ref={ref}
      shadow="md"
      withBorder
      p={4}
      style={{
        position: 'fixed',
        top: menu.y,
        left: menu.x,
        zIndex: 1000,
        minWidth: 180,
      }}
    >
      <Stack gap={0}>
        <UnstyledButton
          onClick={() => {
            openTab(menu.path);
            onClose();
          }}
          px="sm"
          py={6}
          style={{ borderRadius: 'var(--mantine-radius-sm)' }}
          className="navigation-context-menu-item"
        >
          <Group gap="xs" wrap="nowrap">
            <IconExternalLink size={14} />
            <Text size="sm">Open in new tab</Text>
          </Group>
        </UnstyledButton>
      </Stack>
    </Paper>
  );
}

export function NavigationMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);

  const requestMenu = useCallback((x: number, y: number, path: string) => {
    setMenu({ x, y, path });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const value: NavigationMenuContextValue = { requestMenu };

  return (
    <NavigationMenuContext.Provider value={value}>
      {children}
      {menu && <NavigationContextMenu menu={menu} onClose={closeMenu} />}
    </NavigationMenuContext.Provider>
  );
}
