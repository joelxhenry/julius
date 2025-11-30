import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';

export function QuotationsPage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Search Quotations</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="violet">
              <IconFileText size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              Quotation Search
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Search and browse existing quotations. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
