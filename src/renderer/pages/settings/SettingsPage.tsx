import { useState } from 'react';
import {
  Stack,
  Title,
  Paper,
  Tabs,
  Button,
  Group,
} from '@mantine/core';
import {
  IconDatabase,
  IconBuilding,
  IconFileText,
  IconReceipt,
  IconLayout,
  IconFolder,
  IconArrowLeft,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { DatabaseSettingsTab } from './DatabaseSettingsTab';
import { InterfaceSettingsTab } from './InterfaceSettingsTab';
import { CompanySettingsTab } from './CompanySettingsTab';
import { TaxSettingsTab } from './TaxSettingsTab';
import { StorageSettingsTab } from './StorageSettingsTab';
import { DocumentSettingsTab } from './DocumentSettingsTab';
import { AboutSettingsTab } from './AboutSettingsTab';

export function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('database');

  return (
    <Stack p="xl" gap="lg">
      <Group>
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Group>
      <Title order={2}>Settings</Title>

      <Paper p="md" radius="md" withBorder>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
              Database
            </Tabs.Tab>
            <Tabs.Tab value="interface" leftSection={<IconLayout size={16} />}>
              Interface
            </Tabs.Tab>
            <Tabs.Tab value="company" leftSection={<IconBuilding size={16} />}>
              Company
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              Documents
            </Tabs.Tab>
            <Tabs.Tab value="tax" leftSection={<IconReceipt size={16} />}>
              Tax
            </Tabs.Tab>
            <Tabs.Tab value="storage" leftSection={<IconFolder size={16} />}>
              Storage
            </Tabs.Tab>
            <Tabs.Tab value="about" leftSection={<IconInfoCircle size={16} />}>
              About
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="database" pt="lg">
            <DatabaseSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="interface" pt="lg">
            <InterfaceSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="company" pt="lg">
            <CompanySettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="documents" pt="lg">
            <DocumentSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="tax" pt="lg">
            <TaxSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="storage" pt="lg">
            <StorageSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="about" pt="lg">
            <AboutSettingsTab />
          </Tabs.Panel>

        </Tabs>
      </Paper>
    </Stack>
  );
}
