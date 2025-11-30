import { Stack, NavLink as MantineNavLink, Text, Box, ScrollArea, Divider } from '@mantine/core';
import {
  IconHome,
  IconFileInvoice,
  IconFileText,
  IconPackages,
  IconCash,
  IconClock,
  IconDashboard,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  shortcut?: string;
}

const mainNavItems: NavItem[] = [
  { label: 'Home', icon: <IconHome size={20} stroke={1.5} />, path: '/', shortcut: 'Alt+H' },
];

const businessNavItems: NavItem[] = [
  { label: 'Invoices', icon: <IconFileInvoice size={20} stroke={1.5} />, path: '/invoices', shortcut: 'Alt+F' },
  { label: 'Quotations', icon: <IconFileText size={20} stroke={1.5} />, path: '/quotations' },
  { label: 'Inventory', icon: <IconPackages size={20} stroke={1.5} />, path: '/inventory', shortcut: 'Alt+S' },
  { label: 'Payments', icon: <IconCash size={20} stroke={1.5} />, path: '/payments', shortcut: 'Alt+P' },
  { label: 'Attendance', icon: <IconClock size={20} stroke={1.5} />, path: '/attendance', shortcut: 'Alt+C' },
];

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <IconDashboard size={20} stroke={1.5} />, path: '/dashboard', shortcut: 'Alt+D' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const isPathActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = isPathActive(item.path);

    return (
      <MantineNavLink
        key={item.path}
        label={item.label}
        leftSection={item.icon}
        rightSection={
          item.shortcut ? (
            <Text size="xs" c="dimmed">
              {item.shortcut}
            </Text>
          ) : null
        }
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
          {mainNavItems.map(renderNavItem)}

          <Divider my="sm" label="Business" labelPosition="left" />
          {businessNavItems.map(renderNavItem)}

          <Divider my="sm" label="Admin" labelPosition="left" />
          {adminNavItems.map(renderNavItem)}
        </Stack>
      </ScrollArea>

      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="xs" c="dimmed" ta="center">
          Press ? for shortcuts
        </Text>
      </Box>
    </Box>
  );
}
