import { useState, useEffect } from 'react';
import {
  Stack,
  Paper,
  NumberInput,
  Button,
  Text,
  Alert,
  Divider,
  Loader,
  Group,
  Table,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconAlertCircle,
  IconDeviceFloppy,
  IconPercentage,
  IconReceipt,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface TaxSettings {
  taxRate: number; // Stored as decimal (e.g., 0.15 for 15%)
}

export function TaxSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [currentTaxRate, setCurrentTaxRate] = useState<number>(0.15);

  const form = useForm<TaxSettings>({
    initialValues: {
      taxRate: 15, // Display as percentage
    },
    validate: {
      taxRate: (value) => {
        if (value === undefined || value === null) return 'Tax rate is required';
        if (value < 0) return 'Tax rate cannot be negative';
        if (value > 100) return 'Tax rate cannot exceed 100%';
        return null;
      },
    },
    onValuesChange: () => {
      setHasChanges(true);
    },
  });

  useEffect(() => {
    loadTaxSettings();
  }, []);

  const loadTaxSettings = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_TAX_RATE);
      if (result.success && result.data?.taxRate !== undefined) {
        const rate = result.data.taxRate;
        setCurrentTaxRate(rate);
        form.setValues({
          taxRate: rate * 100, // Convert decimal to percentage for display
        });
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to load tax settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load tax settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const validation = form.validate();
    if (validation.hasErrors) {
      return;
    }

    setIsSaving(true);

    try {
      const taxRateDecimal = form.values.taxRate / 100; // Convert percentage to decimal

      const result = await window.electron.invoke(IpcChannel.SET_SYSTEM_SETTING, {
        key: 'tax_rate',
        value: taxRateDecimal.toString(),
        group: 'tax',
        description: 'GCT tax rate (decimal)',
      });

      if (result.success) {
        setCurrentTaxRate(taxRateDecimal);
        setHasChanges(false);
        notifications.show({
          title: 'Settings Saved',
          message: 'Tax rate has been updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else {
        throw new Error(result.error || 'Failed to save tax settings');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save tax settings',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    form.setValues({
      taxRate: currentTaxRate * 100,
    });
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading tax settings...</Text>
      </Stack>
    );
  }

  // Calculate example amounts for preview
  const exampleSubTotal = 10000;
  const previewTaxRate = form.values.taxRate / 100;
  const exampleTax = exampleSubTotal * previewTaxRate;
  const exampleTotal = exampleSubTotal + exampleTax;

  return (
    <Stack gap="lg">
      {/* Current Tax Rate Display */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between">
          <Group gap="sm">
            <IconReceipt size={24} color="var(--mantine-color-blue-6)" />
            <Stack gap={0}>
              <Group gap="xs">
                <Text fw={500}>Current Tax Rate</Text>
                <Badge color="blue" variant="light" size="lg">
                  {(currentTaxRate * 100).toFixed(1)}%
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                GCT (General Consumption Tax)
              </Text>
            </Stack>
          </Group>
        </Group>
      </Paper>

      {/* Tax Rate Configuration */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500} size="lg">Tax Configuration</Text>
          <Divider />

          <NumberInput
            label="Tax Rate"
            description="Enter the GCT rate as a percentage"
            placeholder="15"
            required
            min={0}
            max={100}
            step={0.5}
            decimalScale={2}
            fixedDecimalScale
            suffix="%"
            leftSection={<IconPercentage size={16} />}
            w={{ base: '100%', sm: 300 }}
            {...form.getInputProps('taxRate')}
          />

          {/* Preview Section */}
          {hasChanges && (
            <>
              <Divider my="sm" />
              <Text fw={500} size="sm">Preview (Example Invoice)</Text>
              <Paper p="md" radius="sm" bg="var(--mantine-color-gray-0)">
                <Table withRowBorders={false}>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td c="dimmed">Subtotal:</Table.Td>
                      <Table.Td ta="right">
                        ${exampleSubTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td c="dimmed">Tax ({form.values.taxRate.toFixed(1)}%):</Table.Td>
                      <Table.Td ta="right">
                        ${exampleTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Total:</Table.Td>
                      <Table.Td ta="right" fw={600}>
                        ${exampleTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Paper>
            </>
          )}

          <Divider />

          {/* Action Buttons */}
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={handleReset}
              disabled={isSaving || !hasChanges}
            >
              Reset
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </Paper>

      {/* Info Note */}
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light">
        <Text size="sm">
          The tax rate is applied to all taxable items on invoices and quotations.
          Changes will affect new transactions only; existing documents will retain their original tax calculations.
        </Text>
      </Alert>
    </Stack>
  );
}
