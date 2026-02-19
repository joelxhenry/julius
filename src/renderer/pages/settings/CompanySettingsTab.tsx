import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Paper,
  TextInput,
  Button,
  Text,
  Divider,
  Loader,
  Group,
  Grid,
  Select,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDeviceFloppy,
  IconBuilding,
  IconPhone,
  IconMail,
  IconFileBarcode,
  IconMapPin,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface CompanyFormValues {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyTrn: string;
  currencyCode: string;
  currencySymbol: string;
}

const SETTING_KEYS = {
  companyName: 'company_name',
  companyAddress: 'company_address',
  companyPhone: 'company_phone',
  companyEmail: 'company_email',
  companyTrn: 'company_trn',
  currencyCode: 'currency_code',
  currencySymbol: 'currency_symbol',
} as const;

const CURRENCY_OPTIONS = [
  { value: 'JMD', label: 'JMD - Jamaican Dollar' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'TTD', label: 'TTD - Trinidad & Tobago Dollar' },
  { value: 'BBD', label: 'BBD - Barbados Dollar' },
  { value: 'KYD', label: 'KYD - Cayman Islands Dollar' },
];

const SYMBOL_MAP: Record<string, string> = {
  JMD: '$',
  USD: '$',
  CAD: '$',
  GBP: '£',
  EUR: '€',
  TTD: '$',
  BBD: '$',
  KYD: '$',
};

export function CompanySettingsTab() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedValues, setSavedValues] = useState<CompanyFormValues>({
    companyName: '',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    companyTrn: '',
    currencyCode: 'JMD',
    currencySymbol: '$',
  });

  const form = useForm<CompanyFormValues>({
    initialValues: {
      companyName: '',
      companyAddress: '',
      companyPhone: '',
      companyEmail: '',
      companyTrn: '',
      currencyCode: 'JMD',
      currencySymbol: '$',
    },
    validate: {
      companyEmail: (value) => {
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email address';
        }
        return null;
      },
    },
    onValuesChange: () => {
      setHasChanges(true);
    },
  });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        Object.entries(SETTING_KEYS).map(async ([field, key]) => {
          const result = await window.electron.invoke(IpcChannel.GET_SYSTEM_SETTING_VALUE, { key });
          const val = result.success ? (result.data?.value ?? '') : '';
          return [field, val] as [string, string];
        }),
      );

      const values: Record<string, string> = {};
      for (const [field, value] of results) {
        values[field] = value;
      }

      // Apply defaults for currency if empty
      if (!values.currencyCode) values.currencyCode = 'JMD';
      if (!values.currencySymbol) values.currencySymbol = '$';

      const formValues = values as unknown as CompanyFormValues;
      form.setValues(formValues);
      setSavedValues(formValues);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load company settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load company settings',
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
    const validation = form.validate();
    if (validation.hasErrors) return;

    setIsSaving(true);
    try {
      const entries = Object.entries(SETTING_KEYS) as [keyof CompanyFormValues, string][];

      await Promise.all(
        entries.map(([field, key]) =>
          window.electron.invoke(IpcChannel.UPSERT_SYSTEM_SETTING, {
            key,
            value: form.values[field] || '',
            group: key.startsWith('currency') ? 'currency' : 'company',
          }),
        ),
      );

      setSavedValues({ ...form.values });
      setHasChanges(false);
      notifications.show({
        title: 'Settings Saved',
        message: 'Company settings have been updated',
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

  const handleCurrencyChange = (value: string | null) => {
    if (!value) return;
    form.setFieldValue('currencyCode', value);
    const symbol = SYMBOL_MAP[value] || '$';
    form.setFieldValue('currencySymbol', symbol);
  };

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading company settings...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Company Information */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <IconBuilding size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={500} size="lg">Company Information</Text>
          </Group>
          <Divider />

          <TextInput
            label="Company Name"
            placeholder="Enter your company name"
            leftSection={<IconBuilding size={16} />}
            {...form.getInputProps('companyName')}
          />

          <TextInput
            label="Address"
            placeholder="Enter your business address"
            leftSection={<IconMapPin size={16} />}
            {...form.getInputProps('companyAddress')}
          />

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Phone"
                placeholder="e.g. (876) 555-1234"
                leftSection={<IconPhone size={16} />}
                {...form.getInputProps('companyPhone')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Email"
                placeholder="e.g. info@company.com"
                leftSection={<IconMail size={16} />}
                {...form.getInputProps('companyEmail')}
              />
            </Grid.Col>
          </Grid>

          <TextInput
            label="Tax Registration Number (TRN)"
            placeholder="Enter your TRN"
            leftSection={<IconFileBarcode size={16} />}
            w={{ base: '100%', sm: 300 }}
            {...form.getInputProps('companyTrn')}
          />
        </Stack>
      </Paper>

      {/* Currency Settings */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group gap="sm">
            <IconCurrencyDollar size={20} color="var(--mantine-color-blue-6)" />
            <Text fw={500} size="lg">Currency</Text>
          </Group>
          <Divider />

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Currency"
                placeholder="Select currency"
                data={CURRENCY_OPTIONS}
                searchable
                value={form.values.currencyCode}
                onChange={handleCurrencyChange}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Currency Symbol"
                placeholder="$"
                leftSection={<IconCurrencyDollar size={16} />}
                w={120}
                {...form.getInputProps('currencySymbol')}
              />
            </Grid.Col>
          </Grid>

          <Text size="sm" c="dimmed">
            The currency symbol appears on invoices, quotations, and printed documents.
          </Text>
        </Stack>
      </Paper>

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
