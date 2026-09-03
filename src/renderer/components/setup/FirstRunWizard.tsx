import { useEffect, useState } from 'react';
import {
  Center,
  Container,
  Paper,
  Stack,
  Stepper,
  Title,
  Text,
  Group,
  Button,
  SimpleGrid,
  Card,
  ThemeIcon,
  TextInput,
  NumberInput,
  PasswordInput,
  Switch,
  Radio,
  Alert,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconServer,
  IconDeviceDesktop,
  IconDatabase,
  IconFolder,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconRocket,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import type { MachineRole } from '../../../shared/types/setup';

type StorageType = 'local' | 'lan';

interface DbForm {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface StorageForm {
  type: StorageType;
  lanPath: string;
}

export function FirstRunWizard({ onComplete }: { onComplete: () => void }) {
  const [active, setActive] = useState(0);
  const [role, setRole] = useState<MachineRole | null>(null);

  // Database step state
  const [dbConnected, setDbConnected] = useState(false);
  const [dbBusy, setDbBusy] = useState(false);
  const [dbTest, setDbTest] = useState<{ success: boolean; error?: string } | null>(null);

  // Storage step state
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageTest, setStorageTest] = useState<{ valid: boolean; error?: string } | null>(null);

  const [finishing, setFinishing] = useState(false);

  const dbForm = useForm<DbForm>({
    initialValues: {
      host: 'localhost',
      port: 5432,
      database: 'julius',
      user: 'postgres',
      password: '',
      ssl: false,
    },
    onValuesChange: () => {
      // Any edit invalidates a prior successful connection/test.
      setDbConnected(false);
      setDbTest(null);
    },
  });

  const storageForm = useForm<StorageForm>({
    initialValues: { type: 'local', lanPath: '' },
    onValuesChange: () => setStorageTest(null),
  });

  // Preload any existing (non-secret) DB config.
  useEffect(() => {
    (async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_DATABASE_CONFIG, {});
        if (result?.success && result.data) {
          dbForm.setValues({
            host: result.data.host ?? 'localhost',
            port: result.data.port ?? 5432,
            database: result.data.database ?? 'julius',
            user: result.data.user ?? 'postgres',
            password: '',
            ssl: result.data.ssl ?? false,
          });
        }
      } catch {
        /* fall back to defaults */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseRole = (next: MachineRole) => {
    setRole(next);
    // Tailor sensible defaults to the role without clobbering user edits.
    if (next === 'client') {
      if (dbForm.values.host === 'localhost') dbForm.setFieldValue('host', '');
      storageForm.setFieldValue('type', 'lan');
    } else {
      if (dbForm.values.host === '') dbForm.setFieldValue('host', 'localhost');
      storageForm.setFieldValue('type', 'local');
    }
  };

  const testDb = async () => {
    setDbBusy(true);
    setDbTest(null);
    try {
      const result = await window.electron.invoke(IpcChannel.TEST_DATABASE_CONNECTION, dbForm.values);
      const data = result?.success && result.data ? result.data : { success: false, error: result?.error || 'Test failed' };
      setDbTest(data);
    } catch (error) {
      setDbTest({ success: false, error: error instanceof Error ? error.message : 'Test failed' });
    } finally {
      setDbBusy(false);
    }
  };

  const saveAndConnectDb = async () => {
    setDbBusy(true);
    try {
      const saveResult = await window.electron.invoke(IpcChannel.UPDATE_DATABASE_CONFIG, dbForm.values);
      if (!saveResult?.success) throw new Error(saveResult?.error || 'Failed to save configuration');

      const reconnect = await window.electron.invoke(IpcChannel.RECONNECT_DATABASE, {});
      if (reconnect?.success) {
        setDbConnected(true);
        setDbTest({ success: true });
        setActive(2);
      } else {
        setDbConnected(false);
        setDbTest({ success: false, error: reconnect?.error || 'Connection failed' });
      }
    } catch (error) {
      setDbConnected(false);
      setDbTest({ success: false, error: error instanceof Error ? error.message : 'Failed to connect' });
    } finally {
      setDbBusy(false);
    }
  };

  const testStorage = async () => {
    if (storageForm.values.type !== 'lan') {
      setStorageTest({ valid: true });
      return;
    }
    if (!storageForm.values.lanPath.trim()) {
      setStorageTest({ valid: false, error: 'Network path is required' });
      return;
    }
    setStorageBusy(true);
    setStorageTest(null);
    try {
      const result = await window.electron.invoke(IpcChannel.VALIDATE_STORAGE_PATH, {
        path: storageForm.values.lanPath,
      });
      const data = result?.success && result.data ? result.data : { valid: false, error: result?.error || 'Validation failed' };
      setStorageTest(data);
    } catch (error) {
      setStorageTest({ valid: false, error: error instanceof Error ? error.message : 'Validation failed' });
    } finally {
      setStorageBusy(false);
    }
  };

  const saveStorage = async () => {
    if (storageForm.values.type === 'lan') {
      if (!storageForm.values.lanPath.trim()) {
        setStorageTest({ valid: false, error: 'Network path is required for LAN storage' });
        return;
      }
      if (!storageTest?.valid) {
        notifications.show({
          title: 'Test required',
          message: 'Please test the network path before continuing.',
          color: 'orange',
        });
        return;
      }
    }
    setStorageBusy(true);
    try {
      await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: 'file_storage_type',
        value: storageForm.values.type,
      });
      await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: 'file_storage_path',
        value: storageForm.values.type === 'lan' ? storageForm.values.lanPath : '',
      });
      await window.electron.invoke(IpcChannel.REINITIALIZE_STORAGE, {
        type: storageForm.values.type,
        path: storageForm.values.type === 'lan' ? storageForm.values.lanPath : undefined,
      });
      setActive(3);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save storage settings',
        color: 'red',
      });
    } finally {
      setStorageBusy(false);
    }
  };

  const finish = async () => {
    if (!role) return;
    setFinishing(true);
    try {
      const result = await window.electron.completeSetup?.(role);
      if (result && !result.success) throw new Error(result.error || 'Failed to complete setup');
      notifications.show({
        title: 'Setup complete',
        message: 'Welcome to Turbo Julius!',
        color: 'teal',
        icon: <IconCheck size={16} />,
      });
      onComplete();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to complete setup',
        color: 'red',
      });
      setFinishing(false);
    }
  };

  return (
    <Center mih="100vh" p="md">
      <Container size="sm" w="100%">
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <ThemeIcon size={48} radius="md" variant="light" color="blue">
              <IconRocket size={28} />
            </ThemeIcon>
            <Title order={2}>Welcome to Turbo Julius</Title>
            <Text c="dimmed" size="sm" ta="center">
              Let&apos;s get this machine set up. This only takes a minute.
            </Text>
          </Stack>

          <Paper withBorder radius="md" p="xl">
            <Stepper active={active} size="sm">
              {/* Step 1: Role */}
              <Stepper.Step label="Role" description="Host or client">
                <Stack gap="md" mt="md">
                  <Text size="sm">
                    Is this the <b>host</b> machine that stores the shared database and files, or a{' '}
                    <b>client</b> workstation that connects to a host over the network?
                  </Text>
                  <SimpleGrid cols={{ base: 1, xs: 2 }}>
                    <RoleCard
                      selected={role === 'host'}
                      icon={<IconServer size={26} />}
                      title="Host machine"
                      description="Runs PostgreSQL and owns the shared file storage. Usually one per site."
                      onClick={() => chooseRole('host')}
                    />
                    <RoleCard
                      selected={role === 'client'}
                      icon={<IconDeviceDesktop size={26} />}
                      title="Client workstation"
                      description="Connects to the host's database and shared files over the LAN."
                      onClick={() => chooseRole('client')}
                    />
                  </SimpleGrid>
                  <Group justify="flex-end">
                    <Button disabled={!role} onClick={() => setActive(1)}>
                      Continue
                    </Button>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Step 2: Database */}
              <Stepper.Step label="Database" description="Connection">
                <Stack gap="sm" mt="md">
                  <Group gap="xs">
                    <IconDatabase size={18} />
                    <Text fw={500}>PostgreSQL connection</Text>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {role === 'client'
                      ? "Enter the host machine's IP address and the database credentials your administrator provided."
                      : 'Enter the connection details for the PostgreSQL server running on this machine.'}
                  </Text>

                  <TextInput
                    label="Host"
                    placeholder={role === 'client' ? '192.168.1.10' : 'localhost'}
                    required
                    {...dbForm.getInputProps('host')}
                  />
                  <Group grow>
                    <NumberInput label="Port" min={1} max={65535} required {...dbForm.getInputProps('port')} />
                    <TextInput label="Database name" placeholder="julius" required {...dbForm.getInputProps('database')} />
                  </Group>
                  <Group grow>
                    <TextInput label="Username" placeholder="postgres" required {...dbForm.getInputProps('user')} />
                    <PasswordInput label="Password" placeholder="Enter password" {...dbForm.getInputProps('password')} />
                  </Group>
                  <Switch label="Use SSL" {...dbForm.getInputProps('ssl', { type: 'checkbox' })} />

                  {dbTest && (
                    <Alert
                      color={dbTest.success ? 'green' : 'red'}
                      variant="light"
                      icon={dbTest.success ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
                    >
                      {dbTest.success ? 'Connection successful!' : dbTest.error || 'Connection failed'}
                    </Alert>
                  )}

                  <Group justify="space-between" mt="sm">
                    <Button variant="default" onClick={() => setActive(0)} disabled={dbBusy}>
                      Back
                    </Button>
                    <Group>
                      <Button variant="outline" onClick={testDb} loading={dbBusy}>
                        Test
                      </Button>
                      <Button onClick={saveAndConnectDb} loading={dbBusy}>
                        Connect &amp; continue
                      </Button>
                    </Group>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Step 3: Storage */}
              <Stepper.Step label="Storage" description="File location">
                <Stack gap="sm" mt="md">
                  <Group gap="xs">
                    <IconFolder size={18} />
                    <Text fw={500}>Inventory image storage</Text>
                  </Group>

                  <Radio.Group
                    value={storageForm.values.type}
                    onChange={(value) => storageForm.setFieldValue('type', value as StorageType)}
                  >
                    <Stack mt="xs" gap="sm">
                      <Radio
                        value="local"
                        label="Local storage"
                        description="Store files in this computer's application data folder."
                      />
                      <Radio
                        value="lan"
                        label="LAN file server"
                        description="Store files on a shared network folder used by all workstations."
                      />
                    </Stack>
                  </Radio.Group>

                  {storageForm.values.type === 'lan' && (
                    <>
                      <TextInput
                        label="Network path"
                        description="UNC path to the shared folder on the host"
                        placeholder="\\HOST\JuliusData\inventory-images"
                        required
                        {...storageForm.getInputProps('lanPath')}
                      />
                      <Group>
                        <Button variant="light" onClick={testStorage} loading={storageBusy}>
                          Test path
                        </Button>
                        {storageTest && (
                          <Badge
                            color={storageTest.valid ? 'green' : 'red'}
                            variant="light"
                            leftSection={storageTest.valid ? <IconCheck size={14} /> : <IconX size={14} />}
                          >
                            {storageTest.valid ? 'Path valid' : 'Path invalid'}
                          </Badge>
                        )}
                      </Group>
                      {storageTest && !storageTest.valid && storageTest.error && (
                        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
                          {storageTest.error}
                        </Alert>
                      )}
                    </>
                  )}

                  <Group justify="space-between" mt="sm">
                    <Button variant="default" onClick={() => setActive(1)} disabled={storageBusy}>
                      Back
                    </Button>
                    <Button onClick={saveStorage} loading={storageBusy}>
                      Continue
                    </Button>
                  </Group>
                </Stack>
              </Stepper.Step>

              {/* Completed */}
              <Stepper.Completed>
                <Stack gap="md" mt="md" align="center">
                  <ThemeIcon size={56} radius="xl" variant="light" color="teal">
                    <IconCheck size={32} />
                  </ThemeIcon>
                  <Title order={3}>You&apos;re all set</Title>
                  <Text size="sm" c="dimmed" ta="center" maw={420}>
                    This machine is configured as a <b>{role}</b>. You can change the database and
                    storage settings anytime from Settings.
                  </Text>
                  <Button size="md" loading={finishing} onClick={finish} leftSection={<IconRocket size={18} />}>
                    Start using Turbo Julius
                  </Button>
                </Stack>
              </Stepper.Completed>
            </Stepper>
          </Paper>
        </Stack>
      </Container>
    </Center>
  );
}

function RoleCard({
  selected,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--mantine-color-blue-6)' : undefined,
        borderWidth: selected ? 2 : 1,
      }}
    >
      <Stack gap="xs">
        <ThemeIcon size="lg" radius="md" variant={selected ? 'filled' : 'light'} color="blue">
          {icon}
        </ThemeIcon>
        <Text fw={600}>{title}</Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Stack>
    </Card>
  );
}
