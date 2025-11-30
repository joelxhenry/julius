import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconCash } from '@tabler/icons-react';

export function PaymentsPage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Process Payments</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="teal">
              <IconCash size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              Payment Processing
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Record customer payments against invoices. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
