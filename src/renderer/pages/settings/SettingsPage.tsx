import { Title, Stack, Tabs, Paper, Text, Group, TextInput, NumberInput, Button } from '@mantine/core';
import { IconSettings, IconCurrencyDollar, IconPrinter, IconShield, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';

export function SettingsPage() {
  // Store settings
  const [storeName, setStoreName] = useState('Auto Parts Store');
  const [storePhone, setStorePhone] = useState('');
  const [storeEmail, setStoreEmail] = useState('');
  const [storeAddress, setStoreAddress] = useState('');

  // Tax settings
  const [defaultTaxRate, setDefaultTaxRate] = useState(15);

  // Invoice settings
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');

  const handleSaveStoreSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Store settings have been updated successfully',
      color: 'green',
    });
  };

  const handleSaveTaxSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Tax settings have been updated successfully',
      color: 'green',
    });
  };

  const handleSaveInvoiceSettings = () => {
    notifications.show({
      title: 'Settings Saved',
      message: 'Invoice settings have been updated successfully',
      color: 'green',
    });
  };

  return (
    <Stack>
      <Group>
        <IconSettings size={32} />
        <Title order={2}>Settings</Title>
      </Group>

      <Tabs defaultValue="store">
        <Tabs.List>
          <Tabs.Tab value="store" leftSection={<IconInfoCircle size={16} />}>
            Store Information
          </Tabs.Tab>
          <Tabs.Tab value="tax" leftSection={<IconCurrencyDollar size={16} />}>
            Tax & Currency
          </Tabs.Tab>
          <Tabs.Tab value="printing" leftSection={<IconPrinter size={16} />}>
            Printing
          </Tabs.Tab>
          <Tabs.Tab value="permissions" leftSection={<IconShield size={16} />}>
            Permissions
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="store" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Store Details</Title>
              <Text size="sm" c="dimmed">
                This information will appear on invoices, quotations, and receipts
              </Text>

              <TextInput
                label="Store Name"
                placeholder="Auto Parts Store"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />

              <Group grow>
                <TextInput
                  label="Phone Number"
                  placeholder="(555) 123-4567"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                />

                <TextInput
                  label="Email"
                  placeholder="info@autoparts.com"
                  value={storeEmail}
                  onChange={(e) => setStoreEmail(e.target.value)}
                />
              </Group>

              <TextInput
                label="Address"
                placeholder="123 Main St, City, State 12345"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
              />

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveStoreSettings}>Save Store Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="tax" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Tax Configuration</Title>
              <Text size="sm" c="dimmed">
                Set default tax rates for invoices and quotations
              </Text>

              <NumberInput
                label="Default Tax Rate (%)"
                placeholder="15"
                value={defaultTaxRate}
                onChange={(value) => setDefaultTaxRate(Number(value) || 0)}
                min={0}
                max={100}
                decimalScale={2}
                suffix="%"
              />

              <Text size="sm" c="dimmed" mt="md">
                Currency: USD ($)
              </Text>

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveTaxSettings}>Save Tax Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="printing" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Printing & Documents</Title>
              <Text size="sm" c="dimmed">
                Configure invoice numbering and printing options
              </Text>

              <TextInput
                label="Invoice Number Prefix"
                placeholder="INV-"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                description="This prefix will be added to all invoice numbers"
              />

              <Group justify="flex-end" mt="md">
                <Button onClick={handleSaveInvoiceSettings}>Save Printing Settings</Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="permissions" pt="md">
          <Paper withBorder p="md">
            <Stack>
              <Title order={4}>Roles & Permissions</Title>
              <Text size="sm" c="dimmed">
                Manage employee roles and their permissions
              </Text>

              <Text c="dimmed" ta="center" py="xl">
                Permissions management interface will be implemented here
              </Text>
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
