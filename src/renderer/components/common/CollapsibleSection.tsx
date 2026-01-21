import { ReactNode } from 'react';
import { Paper, Group, Text, ActionIcon, Collapse, Divider, Box } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [opened, { toggle }] = useDisclosure(defaultOpen);

  return (
    <Paper withBorder radius="md">
      <Group
        p="md"
        justify="space-between"
        style={{ cursor: 'pointer' }}
        onClick={toggle}
      >
        <Group gap="xs">
          {icon}
          <Text fw={500}>{title}</Text>
          {badge}
        </Group>
        <ActionIcon variant="subtle" size="sm">
          {opened ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
        </ActionIcon>
      </Group>
      <Collapse in={opened}>
        <Divider />
        <Box p="md">{children}</Box>
      </Collapse>
    </Paper>
  );
}
