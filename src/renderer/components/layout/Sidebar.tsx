import { Stack, NavLink as MantineNavLink, Text, Divider, Box, Paper, Kbd, Group, ScrollArea } from '@mantine/core';
import {
  IconDashboard,
  IconPackage,
  IconUsers,
  IconFileInvoice,
  IconFileText,
  IconCash,
  IconReceipt,
  IconUserCog,
  IconSettings,
  IconKeyboard,
} from '@tabler/icons-react';
import { useTabManager } from '../../contexts/TabManagerContext';
import { getTabTypeFromPath, getDefaultTabTitle } from '../../types/tabs';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconDashboard size={20} stroke={1.5} />, path: '/' },
  { label: 'Inventory', icon: <IconPackage size={20} stroke={1.5} />, path: '/inventory/parts' },
  { label: 'Clients', icon: <IconUsers size={20} stroke={1.5} />, path: '/clients' },
  { label: 'Invoices', icon: <IconFileInvoice size={20} stroke={1.5} />, path: '/invoices' },
  { label: 'Quotations', icon: <IconFileText size={20} stroke={1.5} />, path: '/quotations' },
  { label: 'Payments', icon: <IconCash size={20} stroke={1.5} />, path: '/payments' },
  { label: 'Credit Notes', icon: <IconReceipt size={20} stroke={1.5} />, path: '/credit-notes' },
  { label: 'Users', icon: <IconUserCog size={20} stroke={1.5} />, path: '/users' },
  { label: 'Settings', icon: <IconSettings size={20} stroke={1.5} />, path: '/settings' },
];

const shortcuts = [
  { keys: ['F2'], description: 'Search' },
  { keys: ['F3'], description: 'New Invoice' },
  { keys: ['Ctrl', 'W'], description: 'Close Tab' },
  { keys: ['Ctrl', 'Tab'], description: 'Next Tab' },
  { keys: ['Ctrl', 'Shift', 'L'], description: 'Toggle Theme' },
];

export function Sidebar() {
  const { openTab, getActiveTab } = useTabManager();
  const activeTab = getActiveTab();

  const handleNavClick = (path: string) => {
    const type = getTabTypeFromPath(path);
    const title = getDefaultTabTitle(path, type);
    openTab({ type, path, title, entityId: null });
  };

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--mantine-color-body)',
        borderRight: '1px solid var(--mantine-color-default-border)',
      }}
    >
      <ScrollArea style={{ flex: 1 }} p="md">
        <Stack gap={4}>
          {navItems.map((item) => {
            const isActive = activeTab?.path === item.path;

            return (
              <MantineNavLink
                key={item.path}
                label={item.label}
                leftSection={item.icon}
                active={isActive}
                variant="light"
                onClick={() => handleNavClick(item.path)}
                styles={{
                  root: {
                    borderRadius: 'var(--mantine-radius-md)',
                    transition: 'all 150ms ease',
                    '&:hover': {
                      transform: 'translateX(4px)',
                    },
                  },
                  label: {
                    fontWeight: isActive ? 600 : 500,
                  },
                }}
              />
            );
          })}
        </Stack>
      </ScrollArea>

      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Group gap="xs" mb="xs">
          <IconKeyboard size={14} stroke={1.5} style={{ opacity: 0.5 }} />
          <Text size="xs" c="dimmed" fw={500}>
            Shortcuts
          </Text>
        </Group>
        <Stack gap={6}>
          {shortcuts.map((shortcut, index) => (
            <Group key={index} justify="space-between" gap="xs">
              <Text size="xs" c="dimmed">
                {shortcut.description}
              </Text>
              <Group gap={4}>
                {shortcut.keys.map((key, keyIndex) => (
                  <Kbd key={keyIndex} size="xs">
                    {key}
                  </Kbd>
                ))}
              </Group>
            </Group>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
