import { Dispatch, SetStateAction } from 'react';
import {
  Stack,
  Text,
  Paper,
  Grid,
  TextInput,
  Select,
  Divider,
  Switch,
  Autocomplete,
  Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconSearch } from '@tabler/icons-react';

interface Client {
  id: number;
  clientName: string;
  clNumber: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  isTaxable: boolean;
  discountPct: string;
  creditLimit: string;
  creditTerms: string | null;
  isBadCredit: boolean;
}

interface InvoiceFormHeaderProps {
  invDate: Date;
  setInvDate: Dispatch<SetStateAction<Date>>;
  reference: string;
  setReference: Dispatch<SetStateAction<string>>;
  client: Client | null;
  clientSearch: string;
  setClientSearch: Dispatch<SetStateAction<string>>;
  clientOptions: { value: string; label: string; client: Client }[];
  isSearchingClients: boolean;
  onClientSearchChange: (value: string) => void;
  onClientSelect: (value: string) => void;
  pricing: string;
  setPricing: Dispatch<SetStateAction<string>>;
  creditTerms: string;
  setCreditTerms: Dispatch<SetStateAction<string>>;
  isTaxable: boolean;
  setIsTaxable: Dispatch<SetStateAction<boolean>>;
}

export function InvoiceFormHeader({
  invDate,
  setInvDate,
  reference,
  setReference,
  client,
  clientSearch,
  setClientSearch,
  clientOptions,
  isSearchingClients,
  onClientSearchChange,
  onClientSelect,
  pricing,
  setPricing,
  creditTerms,
  setCreditTerms,
  isTaxable,
  setIsTaxable,
}: InvoiceFormHeaderProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        <Text fw={600}>Invoice Details</Text>
        <Grid>
          <Grid.Col span={6}>
            <DateInput
              label="Invoice Date"
              value={invDate}
              onChange={(value) => value && setInvDate(value)}
              required
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label="Reference"
              value={reference}
              onChange={(e) => setReference(e.currentTarget.value)}
              placeholder="PO number, job ref, etc."
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Autocomplete
              label="Client"
              placeholder="Search by name or client number..."
              value={clientSearch}
              onChange={(value) => {
                setClientSearch(value);
                onClientSearchChange(value);
              }}
              onOptionSubmit={onClientSelect}
              data={clientOptions.map((o) => ({ value: o.value, label: o.label }))}
              rightSection={isSearchingClients ? <Loader size={16} /> : <IconSearch size={16} />}
            />
          </Grid.Col>
          {client && (
            <>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">
                  Address
                </Text>
                <Text size="sm">
                  {[client.address1, client.address2].filter(Boolean).join(', ') || '-'}
                </Text>
              </Grid.Col>
              <Grid.Col span={6}>
                <Text size="sm" c="dimmed">
                  Phone
                </Text>
                <Text size="sm">{client.phone || '-'}</Text>
              </Grid.Col>
            </>
          )}
        </Grid>

        <Divider />

        <Text fw={600}>Options</Text>
        <Grid>
          <Grid.Col span={4}>
            <Select
              label="Pricing"
              value={pricing}
              onChange={(value) => setPricing(value || 'R')}
              data={[
                { value: 'R', label: 'Retail' },
                { value: 'W', label: 'Wholesale' },
              ]}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <TextInput
              label="Credit Terms"
              value={creditTerms}
              onChange={(e) => setCreditTerms(e.currentTarget.value)}
              placeholder="Net 30, COD, etc."
            />
          </Grid.Col>
          <Grid.Col span={4}>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Taxable
              </Text>
              <Switch
                checked={isTaxable}
                onChange={(e) => setIsTaxable(e.currentTarget.checked)}
                label={isTaxable ? 'Yes (15% GCT)' : 'No'}
              />
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Paper>
  );
}
