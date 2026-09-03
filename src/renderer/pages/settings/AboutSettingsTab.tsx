import { Stack, Group, Text, Button, Badge, Paper, Anchor } from '@mantine/core';
import { IconRefresh, IconRocket } from '@tabler/icons-react';
import { useUpdates } from '../../contexts/UpdatesContext';

const RELEASES_URL = 'https://github.com/joelxhenry/julius/releases';

export function AboutSettingsTab() {
  const { version, status, busy, updateReady, checkForUpdates, quitAndInstall } = useUpdates();

  return (
    <Stack gap="lg" maw={520}>
      <Group justify="space-between">
        <div>
          <Text fw={600}>Turbo Julius</Text>
          <Text size="sm" c="dimmed">
            Current version
          </Text>
        </div>
        <Badge size="lg" variant="light">
          v{version ?? '—'}
        </Badge>
      </Group>

      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Software updates
          </Text>
          <Text size="sm" c="dimmed">
            Updates are delivered automatically from GitHub. You can also check manually
            at any time. When an update is downloaded you&apos;ll be prompted to restart.
          </Text>

          {updateReady ? (
            <Button
              color="teal"
              leftSection={<IconRocket size={16} />}
              onClick={quitAndInstall}
            >
              Restart to install update
            </Button>
          ) : (
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={busy}
              onClick={checkForUpdates}
            >
              Check for updates
            </Button>
          )}

          {status.state === 'downloading' && (
            <Text size="xs" c="dimmed">
              Downloading update…
            </Text>
          )}

          <Anchor href={RELEASES_URL} target="_blank" size="xs">
            View release notes
          </Anchor>
        </Stack>
      </Paper>
    </Stack>
  );
}
