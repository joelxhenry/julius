import { Paper, Group, Text, Anchor } from '@mantine/core';
import { IconUser, IconCalendar, IconFileText, IconTag, IconUserCheck } from '@tabler/icons-react';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  pricing: string | null;
}

interface QuotationDetailInfoBarProps {
  quotation: Quotation;
  onViewClient: () => void;
  salespersonName?: string | null;
  onViewSalesperson?: () => void;
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

export function QuotationDetailInfoBar({ quotation, onViewClient, salespersonName, onViewSalesperson }: QuotationDetailInfoBarProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 40 }}>
      <Group gap="lg" wrap="nowrap" h="100%">
        {/* Client */}
        {quotation.clientName && (
          <Group gap={4} wrap="nowrap">
            <IconUser size={14} color="gray" />
            <Anchor size="sm" onClick={onViewClient} c="blue" style={{ cursor: 'pointer' }}>
              {quotation.clientName}
            </Anchor>
          </Group>
        )}

        {/* Salesperson */}
        {salespersonName && (
          <Group gap={4} wrap="nowrap">
            <IconUserCheck size={14} color="gray" />
            <Text size="sm" c="dimmed">Salesperson:</Text>
            <Anchor size="sm" onClick={onViewSalesperson} c="violet" style={{ cursor: 'pointer' }}>
              {salespersonName}
            </Anchor>
          </Group>
        )}

        {/* Date */}
        <Group gap={4} wrap="nowrap">
          <IconCalendar size={14} color="gray" />
          <Text size="sm">{formatDate(quotation.quoteDate)}</Text>
        </Group>

        {/* Reference */}
        {quotation.reference && (
          <Group gap={4} wrap="nowrap">
            <IconFileText size={14} color="gray" />
            <Text size="sm" c="dimmed">Ref:</Text>
            <Text size="sm">{quotation.reference}</Text>
          </Group>
        )}

        {/* Pricing */}
        {quotation.pricing && (
          <Group gap={4} wrap="nowrap">
            <IconTag size={14} color="gray" />
            <Text size="sm" c="dimmed">Pricing:</Text>
            <Text size="sm">{quotation.pricing === 'R' ? 'Retail' : 'Wholesale'}</Text>
          </Group>
        )}
      </Group>
    </Paper>
  );
}
