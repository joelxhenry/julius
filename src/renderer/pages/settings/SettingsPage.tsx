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
import { usePermissions } from '../../permissions';

interface SettingsTab {
  value: string;
  label: string;
  icon: React.ReactNode;
  /** Specific code that grants this tab; omit for tabs everyone on the page can see. */
  permission?: string;
  component: React.ReactNode;
}

const settingsTabs: SettingsTab[] = [
  { value: 'database', label: 'Database', icon: <IconDatabase size={16} />, permission: 'MANAGE_DATABASE', component: <DatabaseSettingsTab /> },
  { value: 'interface', label: 'Interface', icon: <IconLayout size={16} />, permission: 'MANAGE_INTERFACE', component: <InterfaceSettingsTab /> },
  { value: 'company', label: 'Company', icon: <IconBuilding size={16} />, permission: 'MANAGE_COMPANY', component: <CompanySettingsTab /> },
  { value: 'documents', label: 'Documents', icon: <IconFileText size={16} />, permission: 'MANAGE_DOCUMENTS', component: <DocumentSettingsTab /> },
  { value: 'tax', label: 'Tax', icon: <IconReceipt size={16} />, permission: 'MANAGE_TAX', component: <TaxSettingsTab /> },
  { value: 'storage', label: 'Storage', icon: <IconFolder size={16} />, permission: 'MANAGE_STORAGE', component: <StorageSettingsTab /> },
  { value: 'about', label: 'About', icon: <IconInfoCircle size={16} />, component: <AboutSettingsTab /> },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { canAny } = usePermissions();

  // Hide tabs the user can't manage. The MANAGE_SETTINGS umbrella grants all of them.
  const visibleTabs = settingsTabs.filter(
    (tab) => !tab.permission || canAny([tab.permission, 'MANAGE_SETTINGS'])
  );

  const [activeTab, setActiveTab] = useState<string | null>(visibleTabs[0]?.value ?? null);

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
            {visibleTabs.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {visibleTabs.map((tab) => (
            <Tabs.Panel key={tab.value} value={tab.value} pt="lg">
              {tab.component}
            </Tabs.Panel>
          ))}
        </Tabs>
      </Paper>
    </Stack>
  );
}
