import { Paper, Group, Text, Badge } from '@mantine/core';
import { IconUser, IconCalendar, IconFileText, IconCreditCard, IconUserCheck, IconLock } from '@tabler/icons-react';
import { RestrictedLink } from '../../permissions';

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
  salespersonName?: string | null;
  onViewSalesperson?: () => void;
  /** Employee whose access code authorised issuing this invoice ("on record"). */
  issuedByName?: string | null;
  onViewIssuedBy?: () => void;
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

export function CompactDetailInfoBar({ invoice, onViewClient, salespersonName, onViewSalesperson, issuedByName, onViewIssuedBy }: CompactDetailInfoBarProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 40 }}>
      <Group gap="lg" wrap="nowrap" h="100%">
        {/* Client: registered clients link to their record; custom (walk-in) names
            are shown as plain text with a badge since there's no client to open. */}
        {invoice.clientName && (
          <Group gap={4} wrap="nowrap">
            <IconUser size={14} color="gray" />
            {invoice.clientId ? (
              <RestrictedLink permission="VIEW_CLIENTS" size="sm" color="blue" onClick={onViewClient}>
                {invoice.clientName}
              </RestrictedLink>
            ) : (
              <>
                <Text size="sm">{invoice.clientName}</Text>
                <Badge color="orange" variant="light" size="sm">Walk-in</Badge>
              </>
            )}
          </Group>
        )}

        {/* Salesperson */}
        {salespersonName && (
          <Group gap={4} wrap="nowrap">
            <IconUserCheck size={14} color="gray" />
            <Text size="sm" c="dimmed">Salesperson:</Text>
            <RestrictedLink permission="VIEW_EMPLOYEES" size="sm" color="violet" onClick={() => onViewSalesperson?.()}>
              {salespersonName}
            </RestrictedLink>
          </Group>
        )}

        {/* On record: the user whose access code authorised issuing the invoice */}
        {issuedByName && (
          <Group gap={4} wrap="nowrap">
            <IconLock size={14} color="gray" />
            <Text size="sm" c="dimmed">On record:</Text>
            <RestrictedLink permission="VIEW_EMPLOYEES" size="sm" color="teal" onClick={() => onViewIssuedBy?.()}>
              {issuedByName}
            </RestrictedLink>
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
