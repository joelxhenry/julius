import { NavLink } from 'react-router-dom';
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
  { label: 'Employees', icon: <IconUserCog size={20} />, path: '/employees' },
  { label: 'Settings', icon: <IconSettings size={20} />, path: '/settings' },
];

export function Sidebar() {
  return (
    <Stack gap="xs" p="md">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          style={{ textDecoration: 'none' }}
        >
          {({ isActive }) => (
            <MantineNavLink
              label={item.label}
              leftSection={item.icon}
              active={isActive}
              variant="filled"
            />
          )}
        </NavLink>
      ))}

      <Divider my="sm" />

      <Text size="xs" c="dimmed" px="sm">
        Keyboard Shortcuts
      </Text>
      <Stack gap={4} px="sm">
        <Text size="xs" c="dimmed">F2 - Search</Text>
        <Text size="xs" c="dimmed">F3 - New Invoice</Text>
        <Text size="xs" c="dimmed">F4 - New Client</Text>
        <Text size="xs" c="dimmed">F5 - New Part</Text>
      </Stack>
    </Stack>
  );
}
