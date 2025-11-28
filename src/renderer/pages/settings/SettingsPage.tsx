import { Title, Stack, Tabs, Paper, Text, Group, TextInput, NumberInput, Button, Switch, Alert, Badge } from '@mantine/core';
import { IconSettings, IconCurrencyDollar, IconPrinter, IconShield, IconInfoCircle, IconDatabase, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
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

export function SettingsPage() {
  // Store settings
  const [storeName, setStoreName] = useState('Auto Parts Store');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storeAddress, setStoreAddress] = useState('');

  // Tax settings
  const [defaultTaxRate, setDefaultTaxRate] = useState(15);

  // Invoice settings
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');

  // Database settings
  const { isConnected, reconnect } = useDatabaseConnection();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const dbForm = useForm<DatabaseConfig>({
    initialValues: {
      host: 'localhost',
      port: 5432,
      database: 'database',
      user: 'postgres',
      password: '',
      ssl: false,
    },
  });

  // Load existing database config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_DATABASE_CONFIG, {});
        if (result.success && result.data) {
          dbForm.setValues({
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

    loadConfig();
  }, []);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await window.electron.invoke(IpcChannel.TEST_DATABASE_CONNECTION, dbForm.values);
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

  const handleSaveDatabase = async () => {
    setIsSaving(true);
    try {
      const saveResult = await window.electron.invoke(IpcChannel.UPDATE_DATABASE_CONFIG, dbForm.values);
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save configuration');
      }

      const connected = await reconnect();
      if (connected) {
        notifications.show({
          title: 'Database Updated',
          message: 'Database configuration saved and connection established',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        setTestResult(null);
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

  const handleSaveStoreSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Store settings have been updated successfully',
      color: 'green',
    });
  };

  const handleSaveTaxSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Tax settings have been updated successfully',
      color: 'green',
    });
  };

  const handleSaveInvoiceSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Invoice settings have been updated successfully',
      color: 'green',
    });
  };

  return (
    <Stack>
      <Group>
        <IconSettings size={32} />
        <Title order={2}>Settings</Title>
      </Group>

      <Tabs defaultValue="store">
        <Tabs.List>
          <Tabs.Tab value="store" leftSection={<IconInfoCircle size={16} />}>
            Store Information
          </Tabs.Tab>
          <Tabs.Tab value="tax" leftSection={<IconCurrencyDollar size={16} />}>
            Tax & Currency
          </Tabs.Tab>
          <Tabs.Tab value="printing" leftSection={<IconPrinter size={16} />}>
            Printing
          </Tabs.Tab>
          <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
            Database
          </Tabs.Tab>
          <Tabs.Tab value="permissions" leftSection={<IconShield size={16} />}>
            Permissions
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="store" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Store Details</Title>
              <Text size="sm" c="dimmed">
                This information will appear on invoices, quotations, and receipts
              </Text>

              <TextInput
                label="Store Name"
                placeholder="Auto Parts Store"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />

              <Group grow>
                <TextInput
                  label="Phone Number"
                  placeholder="(555) 123-4567"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />

                <TextInput
                  label="Email"
                  placeholder="info@autoparts.com"
                  value={storeEmail}
                  onChange={(e) => setStoreEmail(e.target.value)}
                />
              </Group>

              <TextInput
                label="Address"
                placeholder="123 Main St, City, State 12345"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
              />

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveStoreSettings}>Save Store Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="tax" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Tax Configuration</Title>
              <Text size="sm" c="dimmed">
                Set default tax rates for invoices and quotations
              </Text>

              <NumberInput
                label="Default Tax Rate (%)"
                placeholder="15"
                value={defaultTaxRate}
                onChange={(value) => setDefaultTaxRate(Number(value) || 0)}
                min={0}
                max={100}
                decimalScale={2}
                suffix="%"
              />

              <Text size="sm" c="dimmed" mt="md">
                Currency: USD ($)
              </Text>

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveTaxSettings}>Save Tax Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="printing" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Printing & Documents</Title>
              <Text size="sm" c="dimmed">
                Configure invoice numbering and printing options
              </Text>

              <TextInput
                label="Invoice Number Prefix"
                placeholder="INV-"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                description="This prefix will be added to all invoice numbers"
              />

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveInvoiceSettings}>Save Printing Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="database" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Group justify="space-between">
                <div>
                  <Title order={4}>Database Connection</Title>
                  <Text size="sm" c="dimmed">
                    Configure PostgreSQL database connection settings
                  </Text>
                </div>
                <Badge color={isConnected ? 'green' : 'red'} size="lg" variant="light">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
              </Group>

              <Group grow>
                <TextInput
                  label="Host"
                  placeholder="localhost"
                  required
                  {...dbForm.getInputProps('host')}
                />

                <NumberInput
                  label="Port"
                  placeholder="5432"
                  required
                  min={1}
                  max={65535}
                  {...dbForm.getInputProps('port')}
                />
              </Group>

              <TextInput
                label="Database Name"
                placeholder="julius"
                required
                {...dbForm.getInputProps('database')}
              />

              <Group grow>
                <TextInput
                  label="Username"
                  placeholder="postgres"
                  required
                  {...dbForm.getInputProps('user')}
                />

                <TextInput
                  label="Password"
                  placeholder="Enter password"
                  type="password"
                  {...dbForm.getInputProps('password')}
                />
              </Group>

              <Switch
                label="Use SSL"
                description="Enable SSL/TLS encryption for the database connection"
                {...dbForm.getInputProps('ssl', { type: 'checkbox' })}
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
                  leftSection={<IconDatabase size={16} />}
                >
                  Test Connection
                </Button>

                <Button
                  onClick={handleSaveDatabase}
                  loading={isSaving}
                  disabled={isTesting}
                >
                  Save & Reconnect
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="permissions" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Roles & Permissions</Title>
              <Text size="sm" c="dimmed">
                Manage employee roles and their permissions
              </Text>

              <Text c="dimmed" ta="center" py="xl">
                Permissions management interface will be implemented here
              </Text>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
