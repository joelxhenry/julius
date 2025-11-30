import { Stack, Title, Text, Paper, SimpleGrid, ThemeIcon, Group } from '@mantine/core';
import {
  IconChartBar,
  IconUsers,
  IconSettings,
  IconUserCog,
  IconLock,
} from '@tabler/icons-react';

const dashboardSections = [
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
  },
  {
    title: 'User Management',
    description: 'Manage employee accounts',
    icon: <IconUserCog size={24} />,
    color: 'violet',
  },
  {
    title: 'Access Management',
    description: 'Permissions and access control',
    icon: <IconLock size={24} />,
    color: 'red',
  },
];

export function DashboardPage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Dashboard</Title>
      <Text c="dimmed">
        Administrative features and reports
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {dashboardSections.map((section) => (
          <Paper key={section.title} p="lg" radius="md" withBorder>
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
              <Text size="xs" c="dimmed" fs="italic">
                Under development
              </Text>
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
