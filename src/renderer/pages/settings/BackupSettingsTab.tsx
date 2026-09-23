import { useEffect, useRef, useState } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Badge,
  Divider,
  Alert,
  Switch,
  NumberInput,
  Progress,
  Table,
  ActionIcon,
  Tooltip,
  Loader,
  Anchor,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconBrandGoogleDrive,
  IconCheck,
  IconAlertCircle,
  IconCloudUpload,
  IconDownload,
  IconRestore,
  IconTrash,
  IconPlugConnected,
  IconPlugConnectedX,
  IconDeviceFloppy,
  IconRefresh,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import type {
  BackupStatus,
  BackupFile,
  BackupProgress,
} from '../../../shared/types/backup';

function formatSize(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

export function BackupSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  // Form fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [pgToolsPath, setPgToolsPath] = useState('');
  const [autoBackup, setAutoBackup] = useState(false);
  const [intervalHours, setIntervalHours] = useState<number>(24);

  // Action flags
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  // Latest status in a ref for use inside the progress subscription.
  const restoringRef = useRef(false);

  const loadStatus = async () => {
    if (!window.electron.getBackupStatus) return;
    const result = await window.electron.getBackupStatus();
    if (result.success) {
      setStatus(result.data);
      setClientId(result.data.hasClientId ? '••••••••' : '');
      setPgToolsPath(result.data.pgToolsPath);
      setAutoBackup(result.data.autoBackup);
      setIntervalHours(result.data.autoBackupIntervalHours);
    }
  };

  const loadBackups = async () => {
    if (!window.electron.listBackups) return;
    setLoadingBackups(true);
    try {
      const result = await window.electron.listBackups();
      if (result.success) {
        setBackups(result.data);
      } else {
        setBackups([]);
      }
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadStatus();
      setLoading(false);
    })();

    // Subscribe to progress events.
    const unsubscribe = window.electron.onBackupProgress?.((p) => setProgress(p));
    return () => unsubscribe?.();
  }, []);

  // Once connected, load the backup list.
  useEffect(() => {
    if (status?.connected) {
      void loadBackups();
    }
  }, [status?.connected]);

  const handleSaveSettings = async () => {
    if (!window.electron.saveBackupSettings) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        autoBackup,
        autoBackupIntervalHours: intervalHours,
        pgToolsPath,
      };
      // Only send the client id/secret when the user actually typed new values
      // (the id field shows a masked placeholder once saved).
      if (clientId && !clientId.startsWith('•')) payload.clientId = clientId;
      if (clientSecret) payload.clientSecret = clientSecret;

      const result = await window.electron.saveBackupSettings(payload);
      if (result.success) {
        notifications.show({
          title: 'Settings saved',
          message: 'Backup settings have been updated.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setClientSecret('');
        await loadStatus();
      } else {
        notifications.show({ title: 'Error', message: result.error, color: 'red' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnect = async () => {
    if (!window.electron.connectGoogleDrive) return;
    // Persist any freshly-entered credentials first so the OAuth flow can use them.
    if ((clientId && !clientId.startsWith('•')) || clientSecret) {
      await handleSaveSettings();
    }
    setIsConnecting(true);
    try {
      notifications.show({
        title: 'Opening browser',
        message: 'Complete the Google sign-in in your browser to connect.',
        color: 'blue',
      });
      const result = await window.electron.connectGoogleDrive();
      if (result.success) {
        notifications.show({
          title: 'Connected',
          message: result.data.accountEmail
            ? `Connected to ${result.data.accountEmail}`
            : 'Google Drive connected.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadStatus();
      } else {
        notifications.show({ title: 'Connection failed', message: result.error, color: 'red' });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.electron.disconnectGoogleDrive) return;
    const result = await window.electron.disconnectGoogleDrive();
    if (result.success) {
      setBackups([]);
      await loadStatus();
      notifications.show({ title: 'Disconnected', message: 'Google Drive has been disconnected.', color: 'gray' });
    }
  };

  const handleBackupNow = async () => {
    if (!window.electron.backupNow) return;
    setIsBackingUp(true);
    setProgress(null);
    try {
      const result = await window.electron.backupNow();
      if (result.success) {
        notifications.show({
          title: 'Backup complete',
          message: `Saved "${result.data.file.name}".${result.data.pruned > 0 ? ` Removed ${result.data.pruned} old backup(s).` : ''}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadBackups();
      } else {
        notifications.show({ title: 'Backup failed', message: result.error, color: 'red', autoClose: false });
      }
    } finally {
      setIsBackingUp(false);
      setProgress(null);
    }
  };

  const handleRestore = (file: BackupFile) => {
    modals.openConfirmModal({
      title: 'Restore backup',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            This will <strong>replace all current data and images</strong> with the contents of{' '}
            <strong>{file.name}</strong> ({dayjs(file.createdAt).format('MMM D, YYYY h:mm A')}).
          </Text>
          <Text size="sm" c="red">
            Anything created since that backup will be permanently lost. This cannot be undone.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Restore and overwrite', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!window.electron.restoreBackup) return;
        setBusyFileId(file.id);
        restoringRef.current = true;
        setProgress(null);
        try {
          const result = await window.electron.restoreBackup(file.id);
          if (result.success) {
            notifications.show({
              title: 'Restore complete',
              message: 'Your data has been restored. The app will reload.',
              color: 'green',
              icon: <IconCheck size={16} />,
            });
            // Reload the renderer so all in-memory data reflects the restored DB.
            setTimeout(() => window.location.reload(), 1800);
          } else {
            notifications.show({ title: 'Restore failed', message: result.error, color: 'red', autoClose: false });
          }
        } finally {
          setBusyFileId(null);
          restoringRef.current = false;
          setProgress(null);
        }
      },
    });
  };

  const handleDelete = (file: BackupFile) => {
    modals.openConfirmModal({
      title: 'Delete backup',
      children: (
        <Text size="sm">
          Delete <strong>{file.name}</strong> from Google Drive? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!window.electron.deleteBackup) return;
        setBusyFileId(file.id);
        try {
          const result = await window.electron.deleteBackup(file.id);
          if (result.success) {
            notifications.show({ title: 'Deleted', message: `${file.name} removed.`, color: 'gray' });
            await loadBackups();
          } else {
            notifications.show({ title: 'Error', message: result.error, color: 'red' });
          }
        } finally {
          setBusyFileId(null);
        }
      },
    });
  };

  const handleDownload = async (file: BackupFile) => {
    if (!window.electron.downloadBackup) return;
    setBusyFileId(file.id);
    setProgress(null);
    try {
      const result = await window.electron.downloadBackup(file.id, file.name);
      if (result.success) {
        notifications.show({ title: 'Downloaded', message: `${file.name} saved.`, color: 'green', icon: <IconCheck size={16} /> });
      } else if (result.error !== 'Download cancelled') {
        notifications.show({ title: 'Download failed', message: result.error, color: 'red' });
      }
    } finally {
      setBusyFileId(null);
      setProgress(null);
    }
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading backup settings…</Text>
      </Stack>
    );
  }

  const connected = status?.connected ?? false;
  const showProgressBar = (isBackingUp || busyFileId || restoringRef.current) && progress;

  return (
    <Stack gap="lg">
      {/* Google Drive connection */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Group gap="sm">
              <IconBrandGoogleDrive size={24} />
              <Text fw={500} size="lg">Google Drive</Text>
            </Group>
            <Group gap="xs">
              {connected ? (
                <IconPlugConnected size={20} color="var(--mantine-color-green-6)" />
              ) : (
                <IconPlugConnectedX size={20} color="var(--mantine-color-red-6)" />
              )}
              <Badge color={connected ? 'green' : 'gray'} variant="light">
                {connected ? (status?.accountEmail ?? 'Connected') : 'Not connected'}
              </Badge>
            </Group>
          </Group>

          <Divider />

          <Text size="sm" c="dimmed">
            Create a Google Cloud project, enable the <strong>Google Drive API</strong>, and create an
            OAuth <strong>Desktop app</strong> client. Paste its Client ID and Secret below, then connect.
            The app only accesses the backups it creates.{' '}
            <Anchor href="https://console.cloud.google.com/apis/credentials" target="_blank">
              Open Google Cloud Console
            </Anchor>
          </Text>

          <TextInput
            label="OAuth Client ID"
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.currentTarget.value)}
          />
          <PasswordInput
            label="OAuth Client Secret"
            placeholder={status?.hasClientSecret ? 'Leave blank to keep existing secret' : 'Enter client secret'}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.currentTarget.value)}
          />
          <TextInput
            label="Postgres tools path (optional)"
            description="Folder containing pg_dump / pg_restore. Leave blank to auto-detect."
            placeholder="C:\\Program Files\\PostgreSQL\\16\\bin"
            value={pgToolsPath}
            onChange={(e) => setPgToolsPath(e.currentTarget.value)}
          />

          <Group justify="space-between">
            <Button
              variant="subtle"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSaveSettings}
              loading={isSaving}
            >
              Save Settings
            </Button>
            <Group>
              {connected && (
                <Button variant="default" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              )}
              <Button
                leftSection={<IconBrandGoogleDrive size={16} />}
                onClick={handleConnect}
                loading={isConnecting}
              >
                {connected ? 'Reconnect' : 'Connect Google Drive'}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Paper>

      {/* Automatic backups */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500} size="lg">Automatic Backups</Text>
          <Divider />
          <Group justify="space-between" align="center">
            <Switch
              label="Enable automatic backups"
              description="Runs on a schedule while the app is open (and once at startup when due)."
              checked={autoBackup}
              onChange={(e) => setAutoBackup(e.currentTarget.checked)}
            />
            <NumberInput
              label="Every (hours)"
              min={1}
              max={720}
              value={intervalHours}
              onChange={(v) => setIntervalHours(typeof v === 'number' ? v : 24)}
              w={140}
              disabled={!autoBackup}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="subtle" leftSection={<IconDeviceFloppy size={16} />} onClick={handleSaveSettings} loading={isSaving}>
              Save Settings
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Backups list + actions */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <div>
              <Text fw={500} size="lg">Backups</Text>
              <Text size="xs" c="dimmed">Only the latest 5 backups are kept — the oldest is removed automatically.</Text>
            </div>
            <Group>
              <Tooltip label="Refresh list">
                <ActionIcon variant="default" onClick={loadBackups} disabled={!connected || loadingBackups}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button
                leftSection={<IconCloudUpload size={16} />}
                onClick={handleBackupNow}
                loading={isBackingUp}
                disabled={!connected}
              >
                Back up now
              </Button>
            </Group>
          </Group>

          {showProgressBar && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">{progress?.message}</Text>
              <Progress
                value={progress?.percent ?? 100}
                animated={progress?.percent == null}
                striped={progress?.percent == null}
              />
            </Stack>
          )}

          <Divider />

          {!connected ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Connect Google Drive to create and view backups.
            </Alert>
          ) : loadingBackups ? (
            <Group justify="center" py="md"><Loader size="sm" /></Group>
          ) : backups.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" py="md">No backups yet. Click &ldquo;Back up now&rdquo; to create one.</Text>
          ) : (
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {backups.map((b) => (
                  <Table.Tr key={b.id}>
                    <Table.Td><Text size="sm">{b.name}</Text></Table.Td>
                    <Table.Td><Text size="sm">{dayjs(b.createdAt).format('MMM D, YYYY h:mm A')}</Text></Table.Td>
                    <Table.Td><Text size="sm">{formatSize(b.size)}</Text></Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        <Tooltip label="Restore">
                          <ActionIcon
                            variant="light"
                            color="orange"
                            onClick={() => handleRestore(b)}
                            loading={busyFileId === b.id}
                            disabled={busyFileId !== null && busyFileId !== b.id}
                          >
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Download">
                          <ActionIcon
                            variant="light"
                            onClick={() => handleDownload(b)}
                            disabled={busyFileId !== null}
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => handleDelete(b)}
                            disabled={busyFileId !== null}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>

      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          A backup includes the full database and all product images. Restoring overwrites current data,
          so the app reloads afterwards. Credentials are stored encrypted on this machine.
        </Text>
      </Alert>
    </Stack>
  );
}
