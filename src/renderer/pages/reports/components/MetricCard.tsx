import { Paper, Text, Stack } from '@mantine/core';

interface MetricCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function MetricCard({ label, value, color }: MetricCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text size="xl" fw={700} c={color}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}
