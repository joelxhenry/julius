import { Modal, Stack, Group, Button, TextInput, NumberInput, Switch, Text, Alert, LoadingOverlay } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconDatabase, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDatabaseConnection } from '../../contexts/DatabaseConnectionContext';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

export function DatabaseConfigModal() {
  const { isConnected, isChecking, connectionError, reconnect } = useDatabaseConnection();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const form = useForm<DatabaseConfig>({
    initialValues: {
      host: 'localhost',
      port: 5432,
      database: 'database',
      user: 'postgres',
      password: '',
      ssl: false,
    },
  });

  // Load existing config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_DATABASE_CONFIG, {});
        if (result.success && result.data) {
          form.setValues({
            host: result.data.host || 'localhost',
            port: result.data.port || 5432,
            database: result.data.database || 'julius',
            user: result.data.user || 'postgres',
            password: result.data.password || '',
            ssl: result.data.ssl || false,
          });
        }
      } catch (error) {
        console.error('Failed to load database config:', error);
      }
    };

    if (!isConnected) {
      loadConfig();
    }
  }, [isConnected]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await window.electron.invoke(IpcChannel.TEST_DATABASE_CONNECTION, form.values);
      // The controller wraps the result: { success: true, data: { success: boolean, error?: string } }
      // or { success: false, error: string } on controller-level error
      if (result.success && result.data) {
        setTestResult(result.data);
      } else {
        setTestResult({
          success: false,
          error: result.error || 'Test failed',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndConnect = async () => {
    setIsSaving(true);
    try {
      // Save the configuration
      const saveResult = await window.electron.invoke(IpcChannel.UPDATE_DATABASE_CONFIG, form.values);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save configuration');
      }

      // Attempt to reconnect
      console.log('Calling reconnect...');
      const connected = await reconnect();
      console.log('Reconnect returned:', connected);
      if (connected) {
        notifications.show({
          title: 'Connected',
          message: 'Database connection established successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        notifications.show({
          title: 'Connection Failed',
          message: 'Configuration saved but connection failed. Please check your settings.',
          color: 'red',
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

  // Debug logging
  console.log('DatabaseConfigModal state:', { isConnected, isChecking, connectionError });

  // Don't show if connected
  if (isConnected) {
    console.log('Database connected, closing modal');
    return null;
  }

  return (
    <Modal
      opened={!isConnected && !isChecking}
      onClose={() => {}} // Cannot close - must configure
      title={
        <Group gap="xs">
          <IconDatabase size={20} />
          <Text fw={600}>Database Configuration Required</Text>
        </Group>
      }
      size="md"
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      centered
    >
      <LoadingOverlay visible={isChecking} />

      <Stack>
        <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
          {connectionError || 'Unable to connect to the database. Please configure your database connection settings.'}
        </Alert>

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

        <TextInput
          label="Database Name"
          placeholder="julius"
          required
          {...form.getInputProps('database')}
        />

        <TextInput
          label="Username"
          placeholder="postgres"
          required
          {...form.getInputProps('user')}
        />

        <TextInput
          label="Password"
          placeholder="Enter password"
          type="password"
          {...form.getInputProps('password')}
        />

        <Switch
          label="Use SSL"
          {...form.getInputProps('ssl', { type: 'checkbox' })}
        />

        {testResult && (
          <Alert
            color={testResult.success ? 'green' : 'red'}
            variant="light"
            icon={testResult.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          >
            {testResult.success ? 'Connection successful!' : testResult.error || 'Connection failed'}
          </Alert>
        )}

        <Group justify="space-between" mt="md">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            loading={isTesting}
            disabled={isSaving}
          >
            Test Connection
          </Button>

          <Button
            onClick={handleSaveAndConnect}
            loading={isSaving}
            disabled={isTesting}
          >
            Save & Connect
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
