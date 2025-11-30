import { SimpleGrid, Stack, Title, Text, Box, Kbd, Group } from '@mantine/core';
import {
  IconFileInvoice,
  IconFileText,
  IconPackages,
  IconSearch,
  IconCash,
  IconClock,
  IconDashboard,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ActionCard } from '../components/common/ActionCard';

const actionItems = [
  {
    id: 'create-invoice',
    title: 'Create Invoice',
    description: 'Create a new sales invoice',
    icon: <IconFileInvoice size={24} />,
    shortcut: 'Alt+I',
    path: '/invoices/new',
    color: 'blue',
  },
  {
    id: 'create-quotation',
    title: 'Create Quotation',
    description: 'Create a new price quotation',
    icon: <IconFileText size={24} />,
    shortcut: 'Alt+Q',
    path: '/quotations/new',
    color: 'violet',
  },
  {
    id: 'search-inventory',
    title: 'Search Inventory',
    description: 'Browse and search parts',
    icon: <IconPackages size={24} />,
    shortcut: 'Alt+S',
    path: '/inventory',
    color: 'green',
  },
  {
    id: 'search-invoices',
    title: 'Search Invoices',
    description: 'Find existing invoices',
    icon: <IconSearch size={24} />,
    shortcut: 'Alt+F',
    path: '/invoices',
    color: 'cyan',
  },
  {
    id: 'process-payments',
    title: 'Process Payments',
    description: 'Record customer payments',
    icon: <IconCash size={24} />,
    shortcut: 'Alt+P',
    path: '/payments',
    color: 'teal',
  },
  {
    id: 'clock-in-out',
    title: 'Clock In/Out',
    description: 'Employee time tracking',
    icon: <IconClock size={24} />,
    shortcut: 'Alt+C',
    path: '/attendance',
    color: 'orange',
  },
] as const;

const dashboardItem = {
  id: 'dashboard',
  title: 'Dashboard',
  description: 'Reports, HR, Settings, User Management',
  icon: <IconDashboard size={24} />,
  shortcut: 'Alt+D',
  path: '/dashboard',
  color: 'indigo',
} as const;

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box p="xl" maw={1200} mx="auto">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={2}>Quick Actions</Title>
          <Text c="dimmed" size="sm">
            Select an action below or use keyboard shortcuts
          </Text>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {actionItems.map((item) => (
            <ActionCard
              key={item.id}
              icon={item.icon}
              title={item.title}
              description={item.description}
              shortcut={item.shortcut}
              onClick={() => navigate(item.path)}
              color={item.color}
            />
          ))}
        </SimpleGrid>

        <Box>
          <ActionCard
            icon={dashboardItem.icon}
            title={dashboardItem.title}
            description={dashboardItem.description}
            shortcut={dashboardItem.shortcut}
            onClick={() => navigate(dashboardItem.path)}
            color={dashboardItem.color}
          />
        </Box>

        <Group justify="center" gap="xs" mt="md">
          <Text size="sm" c="dimmed">
            Press
          </Text>
          <Kbd size="sm">?</Kbd>
          <Text size="sm" c="dimmed">
            for keyboard shortcuts
          </Text>
        </Group>
      </Stack>
    </Box>
  );
}
