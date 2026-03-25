import { Paper, Group, Text, Badge, ActionIcon, Button, Menu } from '@mantine/core';
import {
  IconFileInvoice,
  IconEdit,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconArchive,
  IconClock,
} from '@tabler/icons-react';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  clientId: number | null;
  clientName: string | null;
  reference: string | null;
  total: string;
  isArchived: boolean;
}

interface QuotationDetailHeaderProps {
  quotation: Quotation;
  adjacentIds: { previousId: number | null; nextId: number | null };
  onNavigateAdjacent?: (id: number | null) => void;
  onConvertToInvoice: () => void;
  onEdit: () => void;
  onViewClient: () => void;
  onExpire: () => void;
  onArchive: () => void;
}

const formatCurrency = (value: string | number | null) => {
  const num = typeof value === 'number' ? value : parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export function QuotationDetailHeader({
  quotation,
  adjacentIds,
  onNavigateAdjacent,
  onConvertToInvoice,
  onEdit,
  onViewClient,
  onExpire,
  onArchive,
}: QuotationDetailHeaderProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 50 }}>
      <Group justify="space-between" wrap="nowrap" h="100%">
        {/* Left: Quote # and Status */}
        <Group gap="sm" wrap="nowrap">
          {onNavigateAdjacent && (
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
          )}
          <Text fw={600} size="lg">
            Quote {quotation.quoteNum}
          </Text>
          <Badge color={quotation.isArchived ? 'gray' : 'violet'} variant="light" size="sm">
            {quotation.isArchived ? 'Archived' : 'Active'}
          </Badge>
        </Group>

        {/* Center: Total */}
        <Group gap="lg" wrap="nowrap">
          <Group gap={4}>
            <Text size="sm" c="dimmed">Total:</Text>
            <Text size="sm" fw={700}>{formatCurrency(quotation.total)}</Text>
          </Group>
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" wrap="nowrap">
          {!quotation.isArchived && (
            <>
              <Button size="xs" color="green" leftSection={<IconFileInvoice size={14} />} onClick={onConvertToInvoice}>
                Convert to Invoice
              </Button>
              <Button size="xs" variant="light" leftSection={<IconEdit size={14} />} onClick={onEdit}>
                Edit
              </Button>
            </>
          )}

          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="md">
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              {quotation.clientId && (
                <Menu.Item leftSection={<IconUser size={16} />} onClick={onViewClient}>
                  View Client
                </Menu.Item>
              )}
              {!quotation.isArchived && (
                <>
                  <Menu.Item leftSection={<IconClock size={16} />} color="orange" onClick={onExpire}>
                    Mark as Expired
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={onArchive}>
                    Archive Quotation
                  </Menu.Item>
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>
    </Paper>
  );
}
