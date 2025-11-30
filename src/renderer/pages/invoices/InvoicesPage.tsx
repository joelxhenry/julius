import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

export function InvoicesPage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Search Invoices</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="cyan">
              <IconSearch size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              Invoice Search
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Search and browse existing invoices. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
