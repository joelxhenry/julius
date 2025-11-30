import { Paper, Text, Stack, Group, Kbd, UnstyledButton } from '@mantine/core';
import { MantineColor } from '@mantine/core';

interface ActionCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  shortcut: string;
  onClick: () => void;
  color?: MantineColor;
}

export function ActionCard({
  icon,
  title,
  description,
  shortcut,
  onClick,
  color = 'blue',
}: ActionCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <UnstyledButton
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{ width: '100%' }}
    >
      <Paper
        p="lg"
        radius="md"
        withBorder
        style={{
          cursor: 'pointer',
          transition: 'all 150ms ease',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
        styles={{
          root: {
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: 'var(--mantine-shadow-md)',
              borderColor: `var(--mantine-color-${color}-4)`,
            },
            '&:focus-visible': {
              outline: `2px solid var(--mantine-color-${color}-5)`,
              outlineOffset: 2,
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
        }}
      >
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Text
              c={color}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 'var(--mantine-radius-md)',
                backgroundColor: `var(--mantine-color-${color}-light)`,
              }}
            >
              {icon}
            </Text>
            <Kbd size="xs">{shortcut}</Kbd>
          </Group>
          <Stack gap={4}>
            <Text fw={600} size="md">
              {title}
            </Text>
            {description && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {description}
              </Text>
            )}
          </Stack>
        </Stack>
      </Paper>
    </UnstyledButton>
  );
}
