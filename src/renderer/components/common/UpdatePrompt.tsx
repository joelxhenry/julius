import { useState } from 'react';
import { Modal, Text, Button, Group, Stack, ThemeIcon } from '@mantine/core';
import { IconRocket } from '@tabler/icons-react';
import { useUpdates } from '../../contexts/UpdatesContext';

/**
 * App-wide modal that appears once an update has finished downloading, letting
 * the user restart now or dismiss and keep working (the update applies on the
 * next restart regardless).
 */
export function UpdatePrompt() {
  const { updateReady, status, quitAndInstall } = useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const opened = updateReady && !dismissed;
  const version = status.version || status.releaseName;

  return (
    <Modal
      opened={opened}
      onClose={() => setDismissed(true)}
      title="Update ready to install"
      centered
      withCloseButton={!restarting}
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Group wrap="nowrap" align="flex-start">
          <ThemeIcon size="lg" radius="md" variant="light" color="teal">
            <IconRocket size={20} />
          </ThemeIcon>
          <Text size="sm">
            {version ? (
              <>
                Version <b>{version}</b> has been downloaded and is ready to install.
              </>
            ) : (
              'A new version has been downloaded and is ready to install.'
            )}{' '}
            Restart now to apply it, or continue working — it will be applied the next
            time you close the app.
          </Text>
        </Group>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDismissed(true)} disabled={restarting}>
            Later
          </Button>
          <Button
            color="teal"
            loading={restarting}
            onClick={async () => {
              setRestarting(true);
              await quitAndInstall();
            }}
          >
            Restart now
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
