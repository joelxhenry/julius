import { useEffect, useRef, useState } from 'react';
import {
  Stack,
  Group,
  Paper,
  Text,
  TextInput,
  Button,
  Divider,
  Alert,
  Switch,
  NumberInput,
  Progress,
  Table,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconFolder,
  IconFolderOpen,
  IconCheck,
  IconAlertCircle,
  IconCloudUpload,
  IconRestore,
  IconTrash,
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
  const [pgToolsPath, setPgToolsPath] = useState('');
  const [autoBackup, setAutoBackup] = useState(false);
  const [intervalHours, setIntervalHours] = useState<number | ''>(24);

  // Action flags
  const [isSaving, setIsSaving] = useState(false);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoringFromFile, setIsRestoringFromFile] = useState(false);
  const [busyFileName, setBusyFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<BackupProgress | null>(null);

  // Latest status in a ref for use inside the progress subscription.
  const restoringRef = useRef(false);

  const loadStatus = async () => {
    if (!window.electron.getBackupStatus) return;
    const result = await window.electron.getBackupStatus();
    if (result.success) {
      setStatus(result.data);
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

  // Once a folder is configured, load the backup list.
  useEffect(() => {
    if (status?.configured) {
      void loadBackups();
    }
  }, [status?.configured]);

  const handleSaveSettings = async () => {
    if (!window.electron.saveBackupSettings) return;
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        autoBackup,
        autoBackupIntervalHours: intervalHours === '' ? 24 : intervalHours,
        pgToolsPath,
      };

      const result = await window.electron.saveBackupSettings(payload);
      if (result.success) {
        notifications.show({
          title: 'Settings saved',
          message: 'Backup settings have been updated.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadStatus();
      } else {
        notifications.show({ title: 'Error', message: result.error, color: 'red' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChooseFolder = async () => {
    if (!window.electron.chooseBackupFolder) return;
    setIsChoosingFolder(true);
    try {
      const result = await window.electron.chooseBackupFolder();
      if (result.success) {
        notifications.show({
          title: 'Backup folder set',
          message: 'Backups will be written there.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        await loadStatus();
      } else if (result.error !== 'Folder selection cancelled') {
        notifications.show({ title: 'Error', message: result.error, color: 'red' });
      }
    } finally {
      setIsChoosingFolder(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!window.electron.openBackupFolder) return;
    const result = await window.electron.openBackupFolder();
    if (!result.success) {
      notifications.show({ title: 'Error', message: result.error, color: 'red' });
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
        setBusyFileName(file.name);
        restoringRef.current = true;
        setProgress(null);
        try {
          const result = await window.electron.restoreBackup(file.name);
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
          setBusyFileName(null);
          restoringRef.current = false;
          setProgress(null);
        }
      },
    });
  };

  const handleRestoreFromFile = () => {
    modals.openConfirmModal({
      title: 'Restore from file',
      children: (
        <Stack gap="xs">
          <Text size="sm">
            Choose a backup <strong>.zip</strong> file. This will <strong>replace all current data and
            images</strong> with its contents.
          </Text>
          <Text size="sm" c="red">
            Anything created since that backup will be permanently lost. This cannot be undone.
          </Text>
        </Stack>
      ),
      labels: { confirm: 'Choose file…', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!window.electron.restoreBackupFromFile) return;
        setIsRestoringFromFile(true);
        restoringRef.current = true;
        setProgress(null);
        try {
          const result = await window.electron.restoreBackupFromFile();
          if (result.success) {
            notifications.show({
              title: 'Restore complete',
              message: 'Your data has been restored. The app will reload.',
              color: 'green',
              icon: <IconCheck size={16} />,
            });
            setTimeout(() => window.location.reload(), 1800);
          } else if (result.error !== 'Restore cancelled') {
            notifications.show({ title: 'Restore failed', message: result.error, color: 'red', autoClose: false });
          }
        } finally {
          setIsRestoringFromFile(false);
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
          Delete <strong>{file.name}</strong> from the backup folder? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!window.electron.deleteBackup) return;
        setBusyFileName(file.name);
        try {
          const result = await window.electron.deleteBackup(file.name);
          if (result.success) {
            notifications.show({ title: 'Deleted', message: `${file.name} removed.`, color: 'gray' });
            await loadBackups();
          } else {
            notifications.show({ title: 'Error', message: result.error, color: 'red' });
          }
        } finally {
          setBusyFileName(null);
        }
      },
    });
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading backup settings…</Text>
      </Stack>
    );
  }

  if (status && !status.isHost) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        Backups run on the host machine only. This machine is set up as a client — manage backups from
        the host.
      </Alert>
    );
  }

  const configured = status?.configured ?? false;
  const showProgressBar = (isBackingUp || busyFileName || restoringRef.current) && progress;

  return (
    <Stack gap="lg">
      {/* Backup folder */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <IconFolder size={24} />
            <Text fw={500} size="lg">Backup Folder</Text>
          </Group>

          <Divider />

          <Text size="sm" c="dimmed">
            Backups are saved to the folder below — no sign-in or cloud account needed. For an offsite
            copy, point it at a folder already synced by OneDrive, Dropbox, or Google Drive&rsquo;s
            desktop app.
          </Text>

          <TextInput
            label="Folder"
            placeholder="Not set"
            value={status?.backupFolderPath ?? ''}
            readOnly
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
              {configured && (
                <Button variant="default" leftSection={<IconFolderOpen size={16} />} onClick={handleOpenFolder}>
                  Open Folder
                </Button>
              )}
              <Button
                leftSection={<IconFolder size={16} />}
                onClick={handleChooseFolder}
                loading={isChoosingFolder}
              >
                {configured ? 'Change Folder…' : 'Choose Folder…'}
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
              onChange={setIntervalHours}
              onBlur={() => setIntervalHours((v) => (v === '' ? 24 : v))}
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
                <ActionIcon variant="default" onClick={loadBackups} disabled={!configured || loadingBackups}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
              <Button
                variant="default"
                leftSection={<IconRestore size={16} />}
                onClick={handleRestoreFromFile}
                loading={isRestoringFromFile}
              >
                Restore from file…
              </Button>
              <Button
                leftSection={<IconCloudUpload size={16} />}
                onClick={handleBackupNow}
                loading={isBackingUp}
                disabled={!configured}
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

          {!configured ? (
            <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
              Choose a backup folder to create and view backups.
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
                  <Table.Tr key={b.name}>
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
                            loading={busyFileName === b.name}
                            disabled={busyFileName !== null && busyFileName !== b.name}
                          >
                            <IconRestore size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => handleDelete(b)}
                            disabled={busyFileName !== null}
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
          so the app reloads afterwards.
        </Text>
      </Alert>
    </Stack>
  );
}
