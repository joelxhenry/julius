import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';

export function QuotationCreatePage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Create Quotation</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="violet">
              <IconFileText size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              New Quotation
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Create a new price quotation. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
