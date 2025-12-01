import { useState, useEffect } from 'react';
import {
  Stack,
  Group,
  Paper,
  TextInput,
  PasswordInput,
  NumberInput,
  Checkbox,
  Button,
  Text,
  Alert,
  Badge,
  SimpleGrid,
  Divider,
  Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconAlertCircle,
  IconPlugConnected,
  IconPlugConnectedX,
  IconTestPipe,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDatabaseConnection } from '../../contexts/DatabaseConnectionContext';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
}

export function DatabaseSettingsTab() {
  const { isConnected, reconnect } = useDatabaseConnection();
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const form = useForm<DatabaseConfig>({
    initialValues: {
      host: 'localhost',
      port: 5432,
      database: '',
      user: 'postgres',
      password: '',
      ssl: false,
      maxConnections: 20,
    },
    validate: {
      host: (value) => (!value ? 'Host is required' : null),
      port: (value) => (!value || value < 1 || value > 65535 ? 'Port must be between 1 and 65535' : null),
      database: (value) => (!value ? 'Database name is required' : null),
      user: (value) => (!value ? 'Username is required' : null),
    },
    onValuesChange: () => {
      setHasChanges(true);
      setTestResult(null);
    },
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_DATABASE_CONFIG, {});
      if (result.success && result.data) {
        form.setValues({
          host: result.data.host || 'localhost',
          port: result.data.port || 5432,
          database: result.data.database || '',
          user: result.data.user || 'postgres',
          password: '', // Password is not returned for security
          ssl: result.data.ssl || false,
          maxConnections: result.data.maxConnections || 20,
        });
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to load database config:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load database configuration',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await window.electron.invoke(IpcChannel.TEST_DATABASE_CONNECTION, form.values);
      if (result.success && result.data) {
        setTestResult(result.data);
      } else {
        setTestResult({
          success: false,
          error: result.error || 'Connection test failed',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndReconnect = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    setIsSaving(true);

    try {
      // Save the configuration
      const saveResult = await window.electron.invoke(IpcChannel.UPDATE_DATABASE_CONFIG, form.values);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save configuration');
      }

      // Reconnect with new settings
      const connected = await reconnect();

      if (connected) {
        notifications.show({
          title: 'Settings Saved',
          message: 'Database configuration updated and connected successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setHasChanges(false);
        setTestResult(null);
      } else {
        notifications.show({
          title: 'Connection Failed',
          message: 'Configuration saved but connection failed. Please verify your settings.',
          color: 'orange',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save configuration',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading configuration...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Connection Status */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between">
          <Group gap="sm">
            {isConnected ? (
              <IconPlugConnected size={24} color="var(--mantine-color-green-6)" />
            ) : (
              <IconPlugConnectedX size={24} color="var(--mantine-color-red-6)" />
            )}
            <Stack gap={0}>
              <Group gap="xs">
                <Text fw={500}>Connection Status</Text>
                <Badge color={isConnected ? 'green' : 'red'} variant="light" size="sm">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </Group>
              {isConnected && form.values.host && (
                <Text size="sm" c="dimmed">
                  {form.values.host}:{form.values.port}/{form.values.database}
                </Text>
              )}
            </Stack>
          </Group>
        </Group>
      </Paper>

      {/* Database Configuration Form */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500} size="lg">Database Configuration</Text>
          <Divider />

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Host"
              placeholder="localhost"
              required
              {...form.getInputProps('host')}
            />
            <NumberInput
              label="Port"
              placeholder="5432"
              required
              min={1}
              max={65535}
              {...form.getInputProps('port')}
            />
          </SimpleGrid>

          <TextInput
            label="Database Name"
            placeholder="Enter database name"
            required
            {...form.getInputProps('database')}
          />

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Username"
              placeholder="postgres"
              required
              {...form.getInputProps('user')}
            />
            <PasswordInput
              label="Password"
              placeholder="Enter password"
              description="Leave blank to keep existing password"
              {...form.getInputProps('password')}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Checkbox
              label="Enable SSL"
              description="Use secure connection to the database"
              {...form.getInputProps('ssl', { type: 'checkbox' })}
            />
            <NumberInput
              label="Max Connections"
              placeholder="20"
              min={1}
              max={100}
              description="Maximum connection pool size"
              {...form.getInputProps('maxConnections')}
            />
          </SimpleGrid>

          {/* Test Result Alert */}
          {testResult && (
            <Alert
              color={testResult.success ? 'green' : 'red'}
              variant="light"
              icon={testResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
            >
              {testResult.success ? 'Connection test successful!' : testResult.error || 'Connection test failed'}
            </Alert>
          )}

          <Divider />

          {/* Action Buttons */}
          <Group justify="space-between">
            <Button
              variant="outline"
              leftSection={<IconTestPipe size={16} />}
              onClick={handleTestConnection}
              loading={isTesting}
              disabled={isSaving}
            >
              Test Connection
            </Button>

            <Group>
              <Button
                variant="subtle"
                onClick={loadConfig}
                disabled={isTesting || isSaving || !hasChanges}
              >
                Reset
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveAndReconnect}
                loading={isSaving}
                disabled={isTesting || !hasChanges}
              >
                Save & Reconnect
              </Button>
            </Group>
          </Group>
        </Stack>
      </Paper>

      {/* Info Note */}
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          Database credentials are stored securely with encryption. Changes will take effect immediately after saving and reconnecting.
        </Text>
      </Alert>
    </Stack>
  );
}
