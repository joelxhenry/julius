import { useState } from 'react';
import { Stack, NumberInput, Group, Button, Text, Paper } from '@mantine/core';
import { useTabContext } from '../../contexts/TabContext';

export function InterfaceSettingsTab() {
  const { maxTabs, setMaxTabs } = useTabContext();
  const [localMaxTabs, setLocalMaxTabs] = useState(maxTabs);

  const handleSave = () => {
    setMaxTabs(localMaxTabs);
  };

  const hasChanges = localMaxTabs !== maxTabs;

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

      <Group justify="flex-end">
        <Button
          variant="light"
          onClick={() => setLocalMaxTabs(maxTabs)}
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
