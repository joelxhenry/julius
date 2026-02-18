import { Stack, Title, Text, Paper, SimpleGrid, ThemeIcon, Group } from '@mantine/core';
import {
  IconChartBar,
  IconUsers,
  IconSettings,
  IconUserCog,
  IconLock,
  IconFileInvoice,
  IconPackages,
  IconReceipt,
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
    title: 'Invoices',
    description: 'View and search all invoices',
    icon: <IconFileInvoice size={24} />,
    color: 'teal',
    path: '/invoices',
  },
  {
    title: 'Quotations',
    description: 'View and search all quotations',
    icon: <IconFileInvoice size={24} />,
    color: 'teal',
    path: '/quotations',
  },
  {
    title: 'Credit Notes',
    description: 'View and manage issued credit notes',
    icon: <IconReceipt size={24} />,
    color: 'green',
    path: '/credit-notes',
  },
  {
    title: 'Reports',
    description: 'Sales, inventory, and financial reports',
    icon: <IconChartBar size={24} />,
    color: 'blue',
  },
  {
    title: 'HR Features',
    description: 'Employee management and attendance reports',
    icon: <IconUsers size={24} />,
    color: 'green',
  },
  {
    title: 'System Settings',
    description: 'Application configuration',
    icon: <IconSettings size={24} />,
    color: 'gray',
    path: '/settings',
  },
  {
    title: 'User Management',
    description: 'View, create, and manage employee accounts',
    icon: <IconUserCog size={24} />,
    color: 'violet',
    path: '/employees',
  },
  {
    title: 'Access Management',
    description: 'Permissions and access control',
    icon: <IconLock size={24} />,
    color: 'red',
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
