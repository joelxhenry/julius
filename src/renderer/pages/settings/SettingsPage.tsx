import { useState } from 'react';
import {
  Stack,
  Title,
  Paper,
  Tabs,
  Text,
} from '@mantine/core';
import {
  IconDatabase,
  IconBuilding,
  IconFileText,
  IconReceipt,
  IconBell,
} from '@tabler/icons-react';
import { DatabaseSettingsTab } from './DatabaseSettingsTab';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('database');

  return (
    <Stack p="xl" gap="lg">
      <Title order={2}>Settings</Title>

      <Paper p="md" radius="md" withBorder>
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
              Database
            </Tabs.Tab>
            <Tabs.Tab value="company" leftSection={<IconBuilding size={16} />} disabled>
              Company
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />} disabled>
              Documents
            </Tabs.Tab>
            <Tabs.Tab value="tax" leftSection={<IconReceipt size={16} />} disabled>
              Tax
            </Tabs.Tab>
            <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />} disabled>
              Notifications
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="database" pt="lg">
            <DatabaseSettingsTab />
          </Tabs.Panel>

          <Tabs.Panel value="company" pt="lg">
            <Stack align="center" py="xl">
              <IconBuilding size={48} stroke={1} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed">Company settings coming soon</Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="documents" pt="lg">
            <Stack align="center" py="xl">
              <IconFileText size={48} stroke={1} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed">Document settings coming soon</Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="tax" pt="lg">
            <Stack align="center" py="xl">
              <IconReceipt size={48} stroke={1} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed">Tax settings coming soon</Text>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="notifications" pt="lg">
            <Stack align="center" py="xl">
              <IconBell size={48} stroke={1} color="var(--mantine-color-dimmed)" />
              <Text c="dimmed">Notification settings coming soon</Text>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Stack>
  );
}
