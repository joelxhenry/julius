import { Paper, Group, Text, Anchor } from '@mantine/core';
import { IconUser, IconCalendar, IconFileText, IconCreditCard } from '@tabler/icons-react';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  creditTerms: string | null;
  pricing: string | null;
}

interface CompactDetailInfoBarProps {
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

export function CompactDetailInfoBar({ invoice, onViewClient }: CompactDetailInfoBarProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 40 }}>
      <Group gap="lg" wrap="nowrap" h="100%">
        {/* Client */}
        {invoice.clientName && (
          <Group gap={4} wrap="nowrap">
            <IconUser size={14} color="gray" />
            <Anchor size="sm" onClick={onViewClient} c="blue" style={{ cursor: 'pointer' }}>
              {invoice.clientName}
            </Anchor>
          </Group>
        )}

        {/* Date */}
        <Group gap={4} wrap="nowrap">
          <IconCalendar size={14} color="gray" />
          <Text size="sm">{formatDate(invoice.invDate)}</Text>
        </Group>

        {/* Reference */}
        {invoice.reference && (
          <Group gap={4} wrap="nowrap">
            <IconFileText size={14} color="gray" />
            <Text size="sm" c="dimmed">Ref:</Text>
            <Text size="sm">{invoice.reference}</Text>
          </Group>
        )}

        {/* Credit Terms */}
        {invoice.creditTerms && (
          <Group gap={4} wrap="nowrap">
            <IconCreditCard size={14} color="gray" />
            <Text size="sm" c="dimmed">Terms:</Text>
            <Text size="sm">{invoice.creditTerms}</Text>
          </Group>
        )}

        {/* Pricing */}
        {invoice.pricing && (
          <Group gap={4} wrap="nowrap">
            <Text size="sm" c="dimmed">Pricing:</Text>
            <Text size="sm">{invoice.pricing === 'R' ? 'Retail' : 'Wholesale'}</Text>
          </Group>
        )}
      </Group>
    </Paper>
  );
}
