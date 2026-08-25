import { Stack, Title, Text, Paper, SimpleGrid, ThemeIcon, Group } from '@mantine/core';
import {
  IconPlus,
  IconAdjustmentsHorizontal,
  IconTruckDelivery,
  IconTableImport,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

interface ManagementSection {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}

const managementSections: ManagementSection[] = [
  {
    title: 'Add Inventory',
    description: 'Create new inventory items in bulk',
    icon: <IconPlus size={24} />,
    color: 'green',
    path: '/inventory/manage/add',
  },
  {
    title: 'Update Stock',
    description: 'Adjust on-hand quantities for one or many items',
    icon: <IconAdjustmentsHorizontal size={24} />,
    color: 'blue',
    path: '/inventory/manage/stock',
  },
  {
    title: 'Receive from Suppliers',
    description: 'Record incoming stock against a supplier',
    icon: <IconTruckDelivery size={24} />,
    color: 'teal',
    path: '/inventory/manage/receive',
  },
  {
    title: 'Mass Update',
    description: 'Bulk-edit price, stock, supplier, category, and more',
    icon: <IconTableImport size={24} />,
    color: 'orange',
    path: '/inventory/manage/mass-update',
  },
];

export function InventoryManagementPage() {
  const navigate = useNavigate();

  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Inventory Management</Title>
      <Text c="dimmed">
        Add items, adjust stock, receive from suppliers, and run mass updates
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {managementSections.map((section) => (
          <Paper
            key={section.title}
            p="lg"
            radius="md"
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => navigate(section.path)}
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
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
