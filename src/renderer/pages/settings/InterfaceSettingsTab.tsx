import { useState, useEffect } from 'react';
import { Stack, NumberInput, Group, Button, Text, Paper, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';

const RECENT_INVOICES_LIMIT_KEY = 'recent_invoices_limit';

export function InterfaceSettingsTab() {
  const { maxTabs, setMaxTabs } = useTabContext();
  const [localMaxTabs, setLocalMaxTabs] = useState(maxTabs);
  const [recentInvoicesLimit, setRecentInvoicesLimit] = useState(8);
  const [savedRecentInvoicesLimit, setSavedRecentInvoicesLimit] = useState(8);
  const [isLoading, setIsLoading] = useState(true);

  // Load the setting from database on mount
  useEffect(() => {
    const loadSetting = async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
          key: RECENT_INVOICES_LIMIT_KEY,
        });
        if (result.success && result.data?.value !== null) {
          const value = parseInt(result.data.value, 10) || 8;
          setRecentInvoicesLimit(value);
          setSavedRecentInvoicesLimit(value);
        }
      } catch (error) {
        console.error('Failed to load recent invoices limit setting:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSetting();
  }, []);

  const handleSave = async () => {
    // Save tab setting
    setMaxTabs(localMaxTabs);

    // Save recent invoices limit to database
    try {
      const result = await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: RECENT_INVOICES_LIMIT_KEY,
        value: recentInvoicesLimit.toString(),
      });
      if (result.success) {
        setSavedRecentInvoicesLimit(recentInvoicesLimit);
        notifications.show({
          title: 'Settings Saved',
          message: 'Interface settings have been saved',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to save settings',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Failed to save setting:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings',
        color: 'red',
      });
    }
  };

  const handleReset = () => {
    setLocalMaxTabs(maxTabs);
    setRecentInvoicesLimit(savedRecentInvoicesLimit);
  };

  const hasChanges = localMaxTabs !== maxTabs || recentInvoicesLimit !== savedRecentInvoicesLimit;

  if (isLoading) {
    return <Loader size="sm" />;
  }

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="xs">
              Tab Management
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              Configure how tabs behave in the application
            </Text>
          </div>

          <NumberInput
            label="Maximum Open Tabs"
            description="Maximum number of tabs that can be open simultaneously (1-20)"
            value={localMaxTabs}
            onChange={(val) => setLocalMaxTabs(Number(val) || 1)}
            min={1}
            max={20}
            step={1}
            required
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="xs">
              Invoice Page
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              Configure the new invoice page appearance
            </Text>
          </div>

          <NumberInput
            label="Recent Invoices Limit"
            description="Maximum number of recent invoices shown at the top of the new invoice page (0-20)"
            value={recentInvoicesLimit}
            onChange={(val) => setRecentInvoicesLimit(Number(val) || 0)}
            min={0}
            max={20}
            step={1}
          />
        </Stack>
      </Paper>

      <Group justify="flex-end">
        <Button
          variant="light"
          onClick={handleReset}
          disabled={!hasChanges}
        >
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges}>
          Save Changes
        </Button>
      </Group>
    </Stack>
  );
}
