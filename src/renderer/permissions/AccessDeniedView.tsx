import { Stack, Text, Button, ThemeIcon, Paper, Group } from '@mantine/core';
import { IconLockAccess, IconShieldLock } from '@tabler/icons-react';
import { getPermissionByCode } from '../../shared/constants/permissions';

interface AccessDeniedViewProps {
  /** The permission code(s) the view requires. */
  permission?: string | string[];
  /** Optional heading override. */
  title?: string;
  /** Optional description override. */
  description?: string;
  /** Show a "Request access" button that triggers the override flow. */
  onRequestAccess?: () => void;
  /** Render compactly (for inline sections rather than full pages). */
  compact?: boolean;
}

/**
 * A clear, friendly "you don't have permission" panel. Use as the fallback for a
 * PermissionGate, or standalone in a page/section.
 */
export function AccessDeniedView({
  permission,
  title = 'Access restricted',
  description,
  onRequestAccess,
  compact = false,
}: AccessDeniedViewProps) {
  const codes = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  const labels = codes.map((c) => getPermissionByCode(c)?.label ?? c);

  const resolvedDescription =
    description ??
    (labels.length > 0
      ? `You don't have the required permission (${labels.join(', ')}) to view this.`
      : "You don't have permission to view this.");

  return (
    <Paper
      p={compact ? 'md' : 'xl'}
      radius="md"
      withBorder
      style={{ background: 'var(--mantine-color-body)' }}
    >
      <Stack align="center" gap={compact ? 'xs' : 'md'} py={compact ? 'sm' : 'lg'}>
        <ThemeIcon size={compact ? 44 : 64} radius="xl" variant="light" color="gray">
          <IconLockAccess size={compact ? 24 : 34} />
        </ThemeIcon>
        <Stack align="center" gap={4}>
          <Text fw={600} size={compact ? 'md' : 'lg'}>
            {title}
          </Text>
          <Text size="sm" c="dimmed" ta="center" maw={420}>
            {resolvedDescription}
          </Text>
        </Stack>
        {onRequestAccess && (
          <Group>
            <Button
              variant="light"
              color="orange"
              leftSection={<IconShieldLock size={16} />}
              onClick={onRequestAccess}
            >
              Request access
            </Button>
          </Group>
        )}
      </Stack>
    </Paper>
  );
}
