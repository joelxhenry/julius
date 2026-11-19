import { Paper, Group, Text } from '@mantine/core';
import { IconUser, IconCalendar, IconFileText, IconTag, IconUserCheck, IconLock } from '@tabler/icons-react';
import { RestrictedLink } from '../../permissions';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  pricing: string | null;
}

type NavHandler = (event: React.MouseEvent) => void;

interface QuotationDetailInfoBarProps {
  quotation: Quotation;
  onViewClient: NavHandler;
  onViewClientContextMenu?: NavHandler;
  salespersonName?: string | null;
  onViewSalesperson?: NavHandler;
  onViewSalespersonContextMenu?: NavHandler;
  createdByName?: string | null;
  onViewCreatedBy?: NavHandler;
  onViewCreatedByContextMenu?: NavHandler;
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

export function QuotationDetailInfoBar({
  quotation,
  onViewClient,
  onViewClientContextMenu,
  salespersonName,
  onViewSalesperson,
  onViewSalespersonContextMenu,
  createdByName,
  onViewCreatedBy,
  onViewCreatedByContextMenu,
}: QuotationDetailInfoBarProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 40 }}>
      <Group gap="lg" wrap="nowrap" h="100%">
        {/* Client */}
        {quotation.clientName && (
          <Group gap={4} wrap="nowrap">
            <IconUser size={14} color="gray" />
            <RestrictedLink
              permission="VIEW_CLIENTS"
              size="sm"
              color="blue"
              onClick={onViewClient}
              onContextMenu={onViewClientContextMenu}
            >
              {quotation.clientName}
            </RestrictedLink>
          </Group>
        )}

        {/* Salesperson */}
        {salespersonName && (
          <Group gap={4} wrap="nowrap">
            <IconUserCheck size={14} color="gray" />
            <Text size="sm" c="dimmed">Salesperson:</Text>
            <RestrictedLink
              permission="VIEW_EMPLOYEES"
              size="sm"
              color="violet"
              onClick={(e) => onViewSalesperson?.(e)}
              onContextMenu={onViewSalespersonContextMenu}
            >
              {salespersonName}
            </RestrictedLink>
          </Group>
        )}

        {/* On record: the user whose access code authorised creating the quotation */}
        {createdByName && (
          <Group gap={4} wrap="nowrap">
            <IconLock size={14} color="gray" />
            <Text size="sm" c="dimmed">On record:</Text>
            <RestrictedLink
              permission="VIEW_EMPLOYEES"
              size="sm"
              color="teal"
              onClick={(e) => onViewCreatedBy?.(e)}
              onContextMenu={onViewCreatedByContextMenu}
            >
              {createdByName}
            </RestrictedLink>
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
