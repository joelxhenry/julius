import { Center, Stack, Text, Button } from '@mantine/core';
import { IconBox } from '@tabler/icons-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon = <IconBox size={48} />,
  title = 'No data found',
  description,
  action,
}: EmptyStateProps) {
  return (
    <Center p="xl">
      <Stack align="center" gap="md">
        <div style={{ opacity: 0.3 }}>{icon}</div>
        <div style={{ textAlign: 'center' }}>
          <Text size="lg" fw={500} mb="xs">
            {title}
          </Text>
          {description && (
            <Text size="sm" c="dimmed">
              {description}
            </Text>
          )}
        </div>
        {action && (
          <Button onClick={action.onClick} variant="light">
            {action.label}
          </Button>
        )}
      </Stack>
    </Center>
  );
}
