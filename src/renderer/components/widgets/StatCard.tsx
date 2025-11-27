import { Paper, Group, Text, ThemeIcon } from '@mantine/core';
import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
  loading?: boolean;
}

export function StatCard({ title, value, icon, color = 'blue', loading = false }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
            {title}
          </Text>
          <Text fw={700} size="xl">
            {loading ? '...' : value}
          </Text>
        </div>
        <ThemeIcon color={color} variant="light" size={44} radius="md">
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}
