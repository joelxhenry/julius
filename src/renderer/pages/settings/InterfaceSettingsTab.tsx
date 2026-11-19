import { useState, useEffect } from 'react';
import { Stack, NumberInput, Group, Button, Text, Paper, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';

const RECENT_INVOICES_LIMIT_KEY = 'recent_invoices_limit';
const RECENT_QUOTATIONS_LIMIT_KEY = 'recent_quotations_limit';

export function InterfaceSettingsTab() {
  const { maxTabs, setMaxTabs } = useTabContext();
  const [localMaxTabs, setLocalMaxTabs] = useState<number | ''>(maxTabs);
  const [recentInvoicesLimit, setRecentInvoicesLimit] = useState<number | ''>(8);
  const [savedRecentInvoicesLimit, setSavedRecentInvoicesLimit] = useState(8);
  const [recentQuotationsLimit, setRecentQuotationsLimit] = useState<number | ''>(3);
  const [savedRecentQuotationsLimit, setSavedRecentQuotationsLimit] = useState(3);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load recent invoices limit
        const invoicesResult = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
          key: RECENT_INVOICES_LIMIT_KEY,
        });
        if (invoicesResult.success && invoicesResult.data?.value !== null) {
          const value = parseInt(invoicesResult.data.value, 10) || 8;
          setRecentInvoicesLimit(value);
          setSavedRecentInvoicesLimit(value);
        }

        // Load recent quotations limit
        const quotationsResult = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, {
          key: RECENT_QUOTATIONS_LIMIT_KEY,
        });
        if (quotationsResult.success && quotationsResult.data?.value !== null) {
          const value = parseInt(quotationsResult.data.value, 10) || 3;
          setRecentQuotationsLimit(value);
          setSavedRecentQuotationsLimit(value);
        }
      } catch (error) {
        console.error('Failed to load interface settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    // Fields may be left empty mid-edit; fall back to a sensible default rather than persisting ''.
    const maxTabsValue = localMaxTabs === '' ? 1 : localMaxTabs;
    const invoicesLimitValue = recentInvoicesLimit === '' ? 0 : recentInvoicesLimit;
    const quotationsLimitValue = recentQuotationsLimit === '' ? 0 : recentQuotationsLimit;

    // Save tab setting
    setMaxTabs(maxTabsValue);

    // Save settings to database
    try {
      // Save recent invoices limit
      const invoicesResult = await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: RECENT_INVOICES_LIMIT_KEY,
        value: invoicesLimitValue.toString(),
      });

      // Save recent quotations limit
      const quotationsResult = await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: RECENT_QUOTATIONS_LIMIT_KEY,
        value: quotationsLimitValue.toString(),
      });

      if (invoicesResult.success && quotationsResult.success) {
        setLocalMaxTabs(maxTabsValue);
        setRecentInvoicesLimit(invoicesLimitValue);
        setRecentQuotationsLimit(quotationsLimitValue);
        setSavedRecentInvoicesLimit(invoicesLimitValue);
        setSavedRecentQuotationsLimit(quotationsLimitValue);
        notifications.show({
          title: 'Settings Saved',
          message: 'Interface settings have been saved',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: invoicesResult.error || quotationsResult.error || 'Failed to save settings',
          color: 'red',
        });
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
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
    setRecentQuotationsLimit(savedRecentQuotationsLimit);
  };

  const hasChanges = localMaxTabs !== maxTabs ||
    recentInvoicesLimit !== savedRecentInvoicesLimit ||
    recentQuotationsLimit !== savedRecentQuotationsLimit;

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
            onChange={setLocalMaxTabs}
            onBlur={() => setLocalMaxTabs((v) => (v === '' ? 1 : v))}
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
            onChange={setRecentInvoicesLimit}
            onBlur={() => setRecentInvoicesLimit((v) => (v === '' ? 0 : v))}
            min={0}
            max={20}
            step={1}
          />
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <div>
            <Text size="sm" fw={600} mb="xs">
              Quotation Page
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              Configure the new quotation page appearance
            </Text>
          </div>

          <NumberInput
            label="Recent Quotations Limit"
            description="Maximum number of recent quotations shown at the top of the new quotation page (0-20)"
            value={recentQuotationsLimit}
            onChange={setRecentQuotationsLimit}
            onBlur={() => setRecentQuotationsLimit((v) => (v === '' ? 0 : v))}
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
