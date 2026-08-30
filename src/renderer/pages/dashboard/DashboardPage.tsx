import { Stack, Title, Text, Paper, SimpleGrid, ThemeIcon, Group } from '@mantine/core';
import {
  IconChartBar,
  IconSettings,
  IconUserCog,
  IconFileInvoice,
  IconPackages,
  IconShieldLock,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface DashboardSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path?: string;
}

const dashboardSections: DashboardSection[] = [
  {
    title: 'Inventory Management',
    description: 'Add items, adjust stock, receive from suppliers, and run mass updates',
    icon: <IconPackages size={24} />,
    color: 'yellow',
    path: '/inventory/manage',
  },
  {
    title: 'Sales Management',
    description: 'View and manage invoices, quotations, and credit notes',
    icon: <IconFileInvoice size={24} />,
    color: 'teal',
    path: '/sales',
  },
  {
    title: 'Reports',
    description: 'Sales, inventory, and financial reports',
    icon: <IconChartBar size={24} />,
    color: 'blue',
    path: '/reports',
  },
  {
    title: 'System Settings',
    description: 'Application configuration',
    icon: <IconSettings size={24} />,
    color: 'gray',
    path: '/settings',
  },
  {
    title: 'Employee Management',
    description: 'View, create, and manage employee accounts',
    icon: <IconUserCog size={24} />,
    color: 'violet',
    path: '/employees',
  },
  {
    title: 'Roles & Permissions',
    description: 'Create roles, set their permissions, and assign them to employees',
    icon: <IconShieldLock size={24} />,
    color: 'orange',
    path: '/roles',
  },
];

export function DashboardPage() {
  const navigate = useNavigate();

  const handleSectionClick = (section: DashboardSection) => {
    if (section.path) {
      navigate(section.path);
    }
  };

  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">
        Administrative features and reports
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {dashboardSections.map((section) => (
          <Paper
            key={section.title}
            p="lg"
            radius="md"
            withBorder
            style={{ cursor: section.path ? 'pointer' : 'default' }}
            onClick={() => handleSectionClick(section)}
          >
            <Stack gap="sm">
              <Group>
                <ThemeIcon size={40} radius="md" variant="light" color={section.color}>
                  {section.icon}
                </ThemeIcon>
                <Text fw={600}>{section.title}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {section.description}
              </Text>
              {!section.path && (
                <Text size="xs" c="dimmed" fs="italic">
                  Under development
                </Text>
              )}
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
