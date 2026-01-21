import {
  Paper,
  Group,
  Stack,
  Title,
  Text,
  Badge,
  ActionIcon,
  Button,
  Menu,
} from '@mantine/core';
import {
  IconCash,
  IconFileText,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconArchive,
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

interface InvoiceDetailHeaderProps {
  invoice: Invoice;
  adjacentIds: { previousId: number | null; nextId: number | null };
  onNavigateAdjacent: (id: number | null) => void;
  onRecordPayment: () => void;
  onCreateCreditNote: () => void;
  onViewClient: () => void;
  onArchive: () => void;
}

const statusColors: Record<string, string> = {
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  partially_paid: 'Partially Paid',
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

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function InvoiceDetailHeader({
  invoice,
  adjacentIds,
  onNavigateAdjacent,
  onRecordPayment,
  onCreateCreditNote,
  onViewClient,
  onArchive,
}: InvoiceDetailHeaderProps) {
  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        {/* Left: Invoice Info */}
        <Group gap="lg" wrap="nowrap">
          <Stack gap={2}>
            <Group gap="sm">
              <Title order={3}>Invoice {invoice.invNumber}</Title>
              <Badge color={statusColors[invoice.status]} variant="light" size="lg">
                {statusLabels[invoice.status]}
              </Badge>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {formatDate(invoice.invDate)}
              </Text>
              {invoice.clientName && (
                <>
                  <Text size="sm" c="dimmed">•</Text>
                  <Group gap={4}>
                    <Text size="sm" c="dimmed">{invoice.clientName}</Text>
                    {invoice.clientId && (
                      <ActionIcon variant="subtle" size="xs" onClick={onViewClient}>
                        <IconUser size={12} />
                      </ActionIcon>
                    )}
                  </Group>
                </>
              )}
              {invoice.reference && (
                <>
                  <Text size="sm" c="dimmed">•</Text>
                  <Text size="sm" c="dimmed">Ref: {invoice.reference}</Text>
                </>
              )}
            </Group>
          </Stack>
        </Group>

        {/* Center: Summary Totals */}
        <Group gap="xl" wrap="nowrap">
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase">Total</Text>
            <Text size="lg" fw={700}>{formatCurrency(invoice.total)}</Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase">Paid</Text>
            <Text size="lg" fw={600} c="green">{formatCurrency(invoice.totalPaid)}</Text>
          </Stack>
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase">Balance</Text>
            <Text size="lg" fw={700} c={balance > 0 ? 'red' : 'green'}>
              {formatCurrency(balance)}
            </Text>
          </Stack>
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" wrap="nowrap">
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              disabled={!adjacentIds.previousId}
              onClick={() => onNavigateAdjacent(adjacentIds.previousId)}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              disabled={!adjacentIds.nextId}
              onClick={() => onNavigateAdjacent(adjacentIds.nextId)}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>

          {['active', 'partially_paid'].includes(invoice.status) && (
            <Button size="sm" leftSection={<IconCash size={16} />} onClick={onRecordPayment}>
              Record Payment
            </Button>
          )}

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
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
