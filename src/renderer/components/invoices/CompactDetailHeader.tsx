import { Paper, Group, Text, Badge, ActionIcon, Button, Menu } from '@mantine/core';
import {
  IconCash,
  IconFileText,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconArchive,
  IconEdit,
} from '@tabler/icons-react';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  total: string;
  totalPaid: string;
  status: string;
}

interface CompactDetailHeaderProps {
  invoice: Invoice;
  adjacentIds: { previousId: number | null; nextId: number | null };
  onNavigateAdjacent: (id: number | null) => void;
  onRecordPayment: () => void;
  onCreateCreditNote: () => void;
  onViewClient: () => void;
  onArchive: () => void;
  onEdit?: () => void;
}

const statusColors: Record<string, string> = {
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
};

const formatCurrency = (value: string | number | null) => {
  const num = typeof value === 'number' ? value : parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export function CompactDetailHeader({
  invoice,
  adjacentIds,
  onNavigateAdjacent,
  onRecordPayment,
  onCreateCreditNote,
  onViewClient,
  onArchive,
  onEdit,
}: CompactDetailHeaderProps) {
  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);

  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 50 }}>
      <Group justify="space-between" wrap="nowrap" h="100%">
        {/* Left: Invoice # and Status */}
        <Group gap="sm" wrap="nowrap">
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={!adjacentIds.previousId}
              onClick={() => onNavigateAdjacent(adjacentIds.previousId)}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={!adjacentIds.nextId}
              onClick={() => onNavigateAdjacent(adjacentIds.nextId)}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>
          <Text fw={600} size="lg">
            Invoice {invoice.invNumber}
          </Text>
          <Badge color={statusColors[invoice.status]} variant="light" size="sm">
            {statusLabels[invoice.status]}
          </Badge>
        </Group>

        {/* Center: Totals */}
        <Group gap="lg" wrap="nowrap">
          <Group gap={4}>
            <Text size="sm" c="dimmed">Total:</Text>
            <Text size="sm" fw={600}>{formatCurrency(invoice.total)}</Text>
          </Group>
          <Group gap={4}>
            <Text size="sm" c="dimmed">Paid:</Text>
            <Text size="sm" fw={600} c="green">{formatCurrency(invoice.totalPaid)}</Text>
          </Group>
          <Group gap={4}>
            <Text size="sm" c="dimmed">Balance:</Text>
            <Text size="sm" fw={700} c={balance > 0 ? 'red' : 'green'}>
              {formatCurrency(balance)}
            </Text>
          </Group>
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" wrap="nowrap">
          {onEdit && ['active', 'partially_paid'].includes(invoice.status) && (
            <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={onEdit}>
              Edit
            </Button>
          )}
          {['active', 'partially_paid'].includes(invoice.status) && (
            <Button size="xs" leftSection={<IconCash size={14} />} onClick={onRecordPayment}>
              Record Payment
            </Button>
          )}

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="md">
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {['active', 'partially_paid', 'paid'].includes(invoice.status) && (
                <Menu.Item leftSection={<IconFileText size={16} />} onClick={onCreateCreditNote}>
                  Create Credit Note
                </Menu.Item>
              )}
              {invoice.clientId && (
                <Menu.Item leftSection={<IconUser size={16} />} onClick={onViewClient}>
                  View Client
                </Menu.Item>
              )}
              <Menu.Divider />
              <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={onArchive}>
                Archive Invoice
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
}
