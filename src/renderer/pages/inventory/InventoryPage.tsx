import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconPackages } from '@tabler/icons-react';

export function InventoryPage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Inventory</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="green">
              <IconPackages size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              Inventory Search
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Browse and search parts inventory. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
