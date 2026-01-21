import { RefObject } from "react";
import {
  Group,
  TextInput,
  Select,
  Switch,
  Autocomplete,
  Loader,
  Paper,
  ActionIcon,
  Text,
  Stack,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { IconSearch, IconX } from "@tabler/icons-react";

interface Client {
  id: number;
  clientName: string;
  clNumber: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
  isTaxable: boolean;
  discountPct: string | null;
  creditLimit: string | null;
  creditTerms: string | null;
  isBadCredit: boolean;
}

interface CompactFormBarProps {
  invDate: Date;
  setInvDate: (date: Date) => void;
  reference: string;
  setReference: (ref: string) => void;
  client: Client | null;
  clientSearch: string;
  setClientSearch: (search: string) => void;
  clientOptions: { value: string; label: string; client: Client }[];
  isSearchingClients: boolean;
  onClientSearchChange: (value: string) => void;
  onClientSelect: (value: string) => void;
  onClientClear?: () => void;
  pricing: string;
  setPricing: (pricing: string) => void;
  creditTerms: string;
  setCreditTerms: (terms: string) => void;
  isTaxable: boolean;
  setIsTaxable: (taxable: boolean) => void;
  taxRate: number;
  referenceInputRef?: RefObject<HTMLInputElement | null>;
  pricingSelectRef?: RefObject<HTMLInputElement | null>;
}

export function CompactFormBar({
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
  onClientClear,
  pricing,
  setPricing,
  creditTerms,
  setCreditTerms,
  isTaxable,
  setIsTaxable,
  taxRate,
  referenceInputRef,
  pricingSelectRef,
}: CompactFormBarProps) {
  return (
    <Paper withBorder p="xs" radius="md">
      <Stack gap="sm"  h="100%" align="left">
        {/* Client Search */}
        <Autocomplete
          placeholder="Search client..."
          value={clientSearch}
          onChange={(value) => {
            setClientSearch(value);
            onClientSearchChange(value);
          }}
          onOptionSubmit={onClientSelect}
          data={clientOptions.map((o) => ({ value: o.value, label: o.label }))}
          rightSection={
            client && onClientClear ? (
              <ActionIcon size="sm" variant="subtle" onClick={onClientClear}>
                <IconX size={14} />
              </ActionIcon>
            ) : isSearchingClients ? (
              <Loader size={14} />
            ) : (
              <IconSearch size={14} />
            )
          }
          style={{ flex: 1, minWidth: 200, maxWidth: 300 }}
          size="xs"
        />

        <Group gap="md" style={{ flex: 1 }} align="center">
          {/* Client Name Display (if selected) */}
          {client && (
            <Text
              size="sm"
              fw={500}
              c="blue"
              style={{ maxWidth: 300 }}
              truncate
            >
              {client.clientName}
            </Text>
          )}

          {/* Date */}
          <DateInput
            value={invDate}
            onChange={(value) => value && setInvDate(value)}
            size="xs"
            style={{ width: 130 }}
            valueFormat="DD/MM/YYYY"
          />

          {/* Reference */}
          <TextInput
            placeholder="Reference"
            value={reference}
            onChange={(e) => setReference(e.currentTarget.value)}
            size="xs"
            style={{ width: 120 }}
            ref={referenceInputRef}
          />

          {/* Pricing */}
          <Select
            value={pricing}
            onChange={(value) => setPricing(value || "R")}
            data={[
              { value: "R", label: "Retail" },
              { value: "W", label: "Wholesale" },
            ]}
            size="xs"
            style={{ width: 100 }}
            ref={pricingSelectRef}
          />

          {/* Credit Terms */}
          <TextInput
            placeholder="Terms"
            value={creditTerms}
            onChange={(e) => setCreditTerms(e.currentTarget.value)}
            size="xs"
            style={{ width: 80 }}
          />

          {/* Taxable */}
          <Group gap={4} wrap="nowrap">
            <Switch
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.currentTarget.checked)}
              size="xs"
            />
            <Text size="xs" c="dimmed">
              {isTaxable ? `GCT ${(taxRate * 100).toFixed(0)}%` : "No Tax"}
            </Text>
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}
