import { useState } from 'react';
import {
  Paper,
  Text,
  Button,
  Group,
  Stack,
  ThemeIcon,
  ActionIcon,
  Loader,
} from '@mantine/core';
import { IconRocket, IconX } from '@tabler/icons-react';
import { useUpdates } from '../../contexts/UpdatesContext';

/**
 * Persistent, always-visible update prompt pinned to the bottom-right corner.
 *
 * Unlike a one-shot modal, this banner stays put the whole time an update is
 * downloading or waiting to be installed. It only disappears when the user
 * hides it — and hiding is per-version and session-scoped: the same pending
 * update reappears on the next launch (nudging until installed), and any newer
 * version re-surfaces the prompt even within the current session.
 */
export function UpdateBanner() {
  const { status, updateReady, quitAndInstall } = useUpdates();
  const [restarting, setRestarting] = useState(false);
  // Tracks the version the user explicitly hid this session. A different
  // pending version won't match, so the banner comes back.
  const [hiddenVersion, setHiddenVersion] = useState<string | null>(null);

  const version = status.version || status.releaseName || null;
  const versionKey = version ?? 'pending';
  const isDownloading = status.state === 'downloading';
  const isReady = updateReady; // state === 'downloaded'

  const dismissed = isReady && hiddenVersion === versionKey;
  const visible = isDownloading || (isReady && !dismissed);

  if (!visible) return null;

  const hide = () => setHiddenVersion(versionKey);

  return (
    <Paper
      shadow="md"
      radius="md"
      p="md"
      withBorder
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        // Below Mantine modals (z-index 200) so auth/PIN dialogs stay on top,
        // above ordinary app content.
        zIndex: 190,
        maxWidth: 380,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <ThemeIcon size="lg" radius="md" variant="light" color="teal">
          {isReady ? <IconRocket size={20} /> : <Loader size={18} color="teal" />}
        </ThemeIcon>

        <Stack gap="xs" style={{ flex: 1 }}>
          {isReady ? (
            <>
              <Text size="sm">
                {version ? (
                  <>
                    Version <b>{version}</b> is ready to install.
                  </>
                ) : (
                  'A new version is ready to install.'
                )}{' '}
                Restart to apply it, or keep working — it installs the next time you
                close the app.
              </Text>
              <Group gap="xs" justify="flex-end">
                <Button variant="subtle" size="xs" onClick={hide} disabled={restarting}>
                  Later
                </Button>
                <Button
                  color="teal"
                  size="xs"
                  leftSection={<IconRocket size={14} />}
                  loading={restarting}
                  onClick={async () => {
                    setRestarting(true);
                    await quitAndInstall();
                  }}
                >
                  Restart now
                </Button>
              </Group>
            </>
          ) : (
            <Text size="sm">Downloading the latest version…</Text>
          )}
        </Stack>

        {isReady && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={hide}
            aria-label="Hide update prompt"
            disabled={restarting}
          >
            <IconX size={16} />
          </ActionIcon>
        )}
      </Group>
    </Paper>
  );
}
