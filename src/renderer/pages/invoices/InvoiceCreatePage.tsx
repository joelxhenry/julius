import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconFileInvoice } from '@tabler/icons-react';

export function InvoiceCreatePage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Create Invoice</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="blue">
              <IconFileInvoice size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              New Invoice
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Create a new sales invoice. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
