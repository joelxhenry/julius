import { Badge, BadgeProps } from '@mantine/core';

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID' | 'CANCELLED' | 'OVERDUE';
type QuotationStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'EXPIRED' | 'CONVERTED';
type CreditNoteStatus = 'OPEN' | 'PARTIAL' | 'CLOSED';

type Status = InvoiceStatus | QuotationStatus | CreditNoteStatus | string;

interface StatusBadgeProps extends Omit<BadgeProps, 'color' | 'children'> {
  status: Status;
}

const statusColors: Record<string, string> = {
  // Invoice statuses
  DRAFT: 'gray',
  ISSUED: 'blue',
  PARTIAL: 'yellow',
  PAID: 'green',
  CANCELLED: 'red',
  OVERDUE: 'orange',

  // Quotation statuses
  SENT: 'blue',
  APPROVED: 'green',
  EXPIRED: 'red',
  CONVERTED: 'teal',

  // Credit Note statuses
  OPEN: 'blue',
  CLOSED: 'gray',
};

export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const color = statusColors[status.toUpperCase()] || 'gray';

  return (
    <Badge color={color} variant="light" {...props}>
      {status}
    </Badge>
  );
}
