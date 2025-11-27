import { Stack, NavLink as MantineNavLink, Text, Divider } from '@mantine/core';
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
} from '@tabler/icons-react';
import { useTabManager } from '../../contexts/TabManagerContext';
import { getTabTypeFromPath, getDefaultTabTitle } from '../../types/tabs';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconDashboard size={20} />, path: '/' },
  { label: 'Inventory', icon: <IconPackage size={20} />, path: '/inventory/parts' },
  { label: 'Clients', icon: <IconUsers size={20} />, path: '/clients' },
  { label: 'Invoices', icon: <IconFileInvoice size={20} />, path: '/invoices' },
  { label: 'Quotations', icon: <IconFileText size={20} />, path: '/quotations' },
  { label: 'Payments', icon: <IconCash size={20} />, path: '/payments' },
  { label: 'Credit Notes', icon: <IconReceipt size={20} />, path: '/credit-notes' },
  { label: 'Users', icon: <IconUserCog size={20} />, path: '/users' },
  { label: 'Settings', icon: <IconSettings size={20} />, path: '/settings' },
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
    <Stack gap="xs" p="md">
      {navItems.map((item) => {
        // Check if this nav item's path matches the active tab
        const isActive = activeTab?.path === item.path;

        return (
          <MantineNavLink
            key={item.path}
            label={item.label}
            leftSection={item.icon}
            active={isActive}
            variant="filled"
            onClick={() => handleNavClick(item.path)}
            style={{ cursor: 'pointer' }}
          />
        );
      })}

      <Divider my="sm" />

      <Text size="xs" c="dimmed" px="sm">
        Keyboard Shortcuts
      </Text>
      <Stack gap={4} px="sm">
        <Text size="xs" c="dimmed">F2 - Search</Text>
        <Text size="xs" c="dimmed">F3 - New Invoice</Text>
        <Text size="xs" c="dimmed">Ctrl+W - Close Tab</Text>
        <Text size="xs" c="dimmed">Ctrl+Tab - Next Tab</Text>
      </Stack>
    </Stack>
  );
}
