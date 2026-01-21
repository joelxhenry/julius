import { Group, Stack, Text, Divider, ActionIcon } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';

interface Invoice {
  invNumber: string;
  invDate: string;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  reference: string | null;
  creditTerms: string | null;
  pricing: string;
}

interface InvoiceClientDetailsSectionProps {
  invoice: Invoice;
  onViewClient: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function InvoiceClientDetailsSection({
  invoice,
  onViewClient,
}: InvoiceClientDetailsSectionProps) {
  return (
    <Group align="flex-start" gap="xl">
      {/* Invoice Details */}
      <Stack gap="xs" style={{ flex: 1 }}>
        <Text size="sm" fw={600} c="dimmed" tt="uppercase">Invoice Info</Text>
        <Group gap="xl">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Invoice Number</Text>
            <Text size="sm" fw={500}>{invoice.invNumber}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Date</Text>
            <Text size="sm" fw={500}>{formatDate(invoice.invDate)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Reference</Text>
            <Text size="sm" fw={500}>{invoice.reference || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Credit Terms</Text>
            <Text size="sm" fw={500}>{invoice.creditTerms || '-'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Pricing</Text>
            <Text size="sm" fw={500}>{invoice.pricing}</Text>
          </Stack>
        </Group>
      </Stack>

      <Divider orientation="vertical" />

      {/* Client Details */}
      <Stack gap="xs" style={{ flex: 1 }}>
        <Text size="sm" fw={600} c="dimmed" tt="uppercase">Client Info</Text>
        <Group gap="xl">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">Name</Text>
            <Group gap={4}>
              <Text size="sm" fw={500}>{invoice.clientName || 'Walk-in Customer'}</Text>
              {invoice.clientId && (
                <ActionIcon variant="subtle" size="xs" onClick={onViewClient}>
                  <IconUser size={12} />
                </ActionIcon>
              )}
            </Group>
          </Stack>
          {invoice.clientPhone && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Phone</Text>
              <Text size="sm" fw={500}>{invoice.clientPhone}</Text>
            </Stack>
          )}
          {(invoice.clientAddress1 || invoice.clientAddress2) && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">Address</Text>
              <Text size="sm" fw={500}>
                {[invoice.clientAddress1, invoice.clientAddress2].filter(Boolean).join(', ')}
              </Text>
            </Stack>
          )}
        </Group>
      </Stack>
    </Group>
  );
}
