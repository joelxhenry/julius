import { Stack, Title, Text, Paper, Center, ThemeIcon } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

export function AttendancePage() {
  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Clock In/Out</Title>
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="orange">
              <IconClock size={30} />
            </ThemeIcon>
            <Text size="lg" fw={500}>
              Time Tracking
            </Text>
            <Text c="dimmed" ta="center" maw={400}>
              Employee clock in/out and attendance tracking. This feature is under development.
            </Text>
          </Stack>
        </Center>
      </Paper>
    </Stack>
  );
}
