import { useState, useEffect } from 'react';
import {
  Stack,
  Paper,
  TextInput,
  Button,
  Text,
  Alert,
  Divider,
  Loader,
  Group,
  Radio,
  Badge,
  Code,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconAlertCircle,
  IconDeviceFloppy,
  IconFolder,
  IconServer,
  IconTestPipe,
  IconX,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

type StorageType = 'local' | 'lan';

interface StorageSettings {
  type: StorageType;
  lanPath: string;
}

interface StorageInfo {
  type: StorageType;
  path: string;
  accessible: boolean;
}

export function StorageSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const form = useForm<StorageSettings>({
    initialValues: {
      type: 'local',
      lanPath: '',
    },
    validate: {
      lanPath: (value, values) => {
        if (values.type === 'lan' && (!value || value.trim() === '')) {
          return 'Network path is required for LAN storage';
        }
        return null;
      },
    },
    onValuesChange: () => {
      setHasChanges(true);
      setTestResult(null);
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load storage type setting
      const typeResult = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
        key: 'file_storage_type',
      });
      const pathResult = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
        key: 'file_storage_path',
      });
      const infoResult = await window.electron.invoke(IpcChannel.GET_STORAGE_INFO);

      const storageType = (typeResult.success && typeResult.data) || 'local';
      const storagePath = (pathResult.success && pathResult.data) || '';

      form.setValues({
        type: storageType as StorageType,
        lanPath: storagePath,
      });

      if (infoResult.success && infoResult.data) {
        setStorageInfo(infoResult.data);
      }

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load storage settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load storage settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (form.values.type !== 'lan') {
      setTestResult({ valid: true });
      return;
    }

    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await window.electron.invoke(IpcChannel.VALIDATE_STORAGE_PATH, {
        path: form.values.lanPath,
      });

      if (result.success && result.data) {
        setTestResult(result.data);
        if (result.data.valid) {
          notifications.show({
            title: 'Connection Successful',
            message: 'Storage path is accessible and writable',
            color: 'green',
            icon: <IconCheck size={16} />,
          });
        }
      } else {
        setTestResult({ valid: false, error: result.error || 'Failed to validate path' });
      }
    } catch (error) {
      setTestResult({
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to test connection',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    // If LAN, require successful test first
    if (form.values.type === 'lan' && (!testResult || !testResult.valid)) {
      notifications.show({
        title: 'Test Required',
        message: 'Please test the connection before saving LAN settings',
        color: 'orange',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Save storage type
      await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: 'file_storage_type',
        value: form.values.type,
      });

      // Save storage path
      await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: 'file_storage_path',
        value: form.values.type === 'lan' ? form.values.lanPath : '',
      });

      // Reinitialize storage service
      const reinitResult = await window.electron.invoke(IpcChannel.REINITIALIZE_STORAGE, {
        type: form.values.type,
        path: form.values.type === 'lan' ? form.values.lanPath : undefined,
      });

      if (reinitResult.success && reinitResult.data) {
        setStorageInfo(reinitResult.data);
      }

      setHasChanges(false);
      notifications.show({
        title: 'Settings Saved',
        message: 'Storage settings have been updated successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save storage settings',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    setTestResult(null);
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading storage settings...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Current Storage Status */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between">
          <Group gap="sm">
            <IconFolder size={24} color="var(--mantine-color-blue-6)" />
            <Stack gap={0}>
              <Group gap="xs">
                <Text fw={500}>Current Storage</Text>
                <Badge
                  color={storageInfo?.accessible ? 'green' : 'red'}
                  variant="light"
                  size="lg"
                >
                  {storageInfo?.accessible ? 'Accessible' : 'Not Accessible'}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Type: {storageInfo?.type === 'lan' ? 'LAN File Server' : 'Local Storage'}
              </Text>
            </Stack>
          </Group>
        </Group>
        {storageInfo && (
          <Code block mt="sm" style={{ wordBreak: 'break-all' }}>
            {storageInfo.path}
          </Code>
        )}
      </Paper>

      {/* Storage Configuration */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500} size="lg">Storage Configuration</Text>
          <Divider />

          <Radio.Group
            label="Storage Type"
            description="Choose where inventory images will be stored"
            value={form.values.type}
            onChange={(value) => form.setFieldValue('type', value as StorageType)}
          >
            <Stack mt="sm" gap="md">
              <Radio
                value="local"
                label="Local Storage (Default)"
                description="Store files on this computer's application data folder"
                icon={({ ...others }) => <IconFolder size={16} {...others} />}
              />
              <Radio
                value="lan"
                label="LAN File Server"
                description="Store files on a shared network location accessible by all workstations"
                icon={({ ...others }) => <IconServer size={16} {...others} />}
              />
            </Stack>
          </Radio.Group>

          {/* LAN Path Configuration */}
          {form.values.type === 'lan' && (
            <>
              <Divider my="sm" />
              <TextInput
                label="Network Path"
                description="Enter the UNC path to the shared folder (e.g., \\SERVER\shared)"
                placeholder="\\SERVER\shared\inventory"
                required
                {...form.getInputProps('lanPath')}
              />

              <Group gap="sm">
                <Button
                  variant="light"
                  leftSection={<IconTestPipe size={16} />}
                  onClick={handleTestConnection}
                  loading={isTesting}
                >
                  Test Connection
                </Button>

                {testResult && (
                  <Badge
                    color={testResult.valid ? 'green' : 'red'}
                    variant="light"
                    size="lg"
                    leftSection={testResult.valid ? <IconCheck size={14} /> : <IconX size={14} />}
                  >
                    {testResult.valid ? 'Path Valid' : 'Path Invalid'}
                  </Badge>
                )}
              </Group>

              {testResult && !testResult.valid && testResult.error && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                  {testResult.error}
                </Alert>
              )}
            </>
          )}

          <Divider />

          {/* Action Buttons */}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={handleReset}
              disabled={isSaving || !hasChanges}
            >
              Reset
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Info Note */}
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          Changing storage location will not move existing images. Images uploaded before the change
          will remain at their original location. For LAN storage, ensure all workstations have
          read/write access to the shared folder.
        </Text>
      </Alert>
    </Stack>
  );
}
