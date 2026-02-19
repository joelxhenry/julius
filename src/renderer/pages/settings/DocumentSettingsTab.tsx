import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Paper,
  Text,
  Divider,
  Loader,
  Group,
  Grid,
  Select,
  Button,
  Autocomplete,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDeviceFloppy,
  IconPrinter,
  IconFileText,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface DocumentSettingsFormValues {
  printFormatInvoice: string;
  printFormatQuotation: string;
  printFormatCreditNote: string;
  printFormatPaymentReceipt: string;
  thermalPaperWidth: string;
  thermalPrinterName: string;
}

const SETTING_KEYS = {
  printFormatInvoice: 'print_format_invoice',
  printFormatQuotation: 'print_format_quotation',
  printFormatCreditNote: 'print_format_credit_note',
  printFormatPaymentReceipt: 'print_format_payment_receipt',
  thermalPaperWidth: 'thermal_paper_width',
  thermalPrinterName: 'thermal_printer_name',
} as const;

const FORMAT_OPTIONS = [
  { value: 'standard', label: 'Standard (Letter)' },
  { value: 'thermal', label: 'Thermal (Receipt)' },
];

const PAPER_WIDTH_OPTIONS = [
  { value: '80mm', label: '80mm (standard)' },
  { value: '58mm', label: '58mm (narrow)' },
];

export function DocumentSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [printerOptions, setPrinterOptions] = useState<string[]>([]);
  const [savedValues, setSavedValues] = useState<DocumentSettingsFormValues>({
    printFormatInvoice: 'standard',
    printFormatQuotation: 'standard',
    printFormatCreditNote: 'standard',
    printFormatPaymentReceipt: 'standard',
    thermalPaperWidth: '80mm',
    thermalPrinterName: '',
  });

  const form = useForm<DocumentSettingsFormValues>({
    initialValues: {
      printFormatInvoice: 'standard',
      printFormatQuotation: 'standard',
      printFormatCreditNote: 'standard',
      printFormatPaymentReceipt: 'standard',
      thermalPaperWidth: '80mm',
      thermalPrinterName: '',
    },
    onValuesChange: () => {
      setHasChanges(true);
    },
  });

  const hasThermalFormat = form.values.printFormatInvoice === 'thermal'
    || form.values.printFormatQuotation === 'thermal'
    || form.values.printFormatCreditNote === 'thermal'
    || form.values.printFormatPaymentReceipt === 'thermal';

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResults, printersResult] = await Promise.all([
        Promise.all(
          Object.entries(SETTING_KEYS).map(async ([field, key]) => {
            const result = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, { key });
            const val = result.success ? (result.data?.value ?? '') : '';
            return [field, val] as [string, string];
          }),
        ),
        window.electron.invoke(IpcChannel.GET_AVAILABLE_PRINTERS),
      ]);

      // Build form values
      const values: Record<string, string> = {};
      for (const [field, value] of settingsResults) {
        values[field] = value;
      }

      // Apply defaults
      if (!values.printFormatInvoice) values.printFormatInvoice = 'standard';
      if (!values.printFormatQuotation) values.printFormatQuotation = 'standard';
      if (!values.printFormatCreditNote) values.printFormatCreditNote = 'standard';
      if (!values.printFormatPaymentReceipt) values.printFormatPaymentReceipt = 'standard';
      if (!values.thermalPaperWidth) values.thermalPaperWidth = '80mm';
      if (!values.thermalPrinterName) values.thermalPrinterName = '';

      const formValues = values as unknown as DocumentSettingsFormValues;
      form.setValues(formValues);
      setSavedValues(formValues);
      setHasChanges(false);

      // Build printer suggestions from discovered printers
      if (printersResult.success && printersResult.data) {
        setPrinterOptions(
          printersResult.data.map((p: { name: string }) => p.name),
        );
      }
    } catch (error) {
      console.error('Failed to load document settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load document settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const entries = Object.entries(SETTING_KEYS) as [keyof DocumentSettingsFormValues, string][];

      await Promise.all(
        entries.map(([field, key]) =>
          window.electron.invoke(IpcChannel.UPSERT_SYSTEM_SETTING, {
            key,
            value: form.values[field] || '',
            group: 'printing',
          }),
        ),
      );

      setSavedValues({ ...form.values });
      setHasChanges(false);
      notifications.show({
        title: 'Settings Saved',
        message: 'Document print settings have been updated',
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save settings',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    form.setValues({ ...savedValues });
    setHasChanges(false);
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading document settings...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Print Format by Document Type */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <IconFileText size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={500} size="lg">Print Format by Document Type</Text>
          </Group>
          <Divider />

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Invoice"
                data={FORMAT_OPTIONS}
                value={form.values.printFormatInvoice}
                onChange={(v) => v && form.setFieldValue('printFormatInvoice', v)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Quotation"
                data={FORMAT_OPTIONS}
                value={form.values.printFormatQuotation}
                onChange={(v) => v && form.setFieldValue('printFormatQuotation', v)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Credit Note"
                data={FORMAT_OPTIONS}
                value={form.values.printFormatCreditNote}
                onChange={(v) => v && form.setFieldValue('printFormatCreditNote', v)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Payment Receipt"
                data={FORMAT_OPTIONS}
                value={form.values.printFormatPaymentReceipt}
                onChange={(v) => v && form.setFieldValue('printFormatPaymentReceipt', v)}
              />
            </Grid.Col>
          </Grid>

          <Text size="sm" c="dimmed">
            Standard prints on Letter paper. Thermal prints a narrow receipt format for thermal printers.
          </Text>
        </Stack>
      </Paper>

      {/* Thermal Printer Settings */}
      {hasThermalFormat && (
        <Paper p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="sm">
              <IconPrinter size={20} color="var(--mantine-color-blue-6)" />
              <Text fw={500} size="lg">Thermal Printer Settings</Text>
            </Group>
            <Divider />

            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Paper Width"
                  data={PAPER_WIDTH_OPTIONS}
                  value={form.values.thermalPaperWidth}
                  onChange={(v) => v && form.setFieldValue('thermalPaperWidth', v)}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Autocomplete
                  label="Default Thermal Printer"
                  placeholder="Select or type a printer name"
                  data={printerOptions}
                  value={form.values.thermalPrinterName}
                  onChange={(v) => form.setFieldValue('thermalPrinterName', v)}
                />
              </Grid.Col>
            </Grid>

            <Text size="sm" c="dimmed">
              Select a local printer from the list or type a network printer path (e.g. \\SERVER\PrinterName).
              When set, documents print directly without a dialog. Leave empty for the system print dialog.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Actions */}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={handleReset} disabled={isSaving || !hasChanges}>
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
  );
}
