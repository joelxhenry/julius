import { Group, Text, Button, ActionIcon, Paper } from '@mantine/core';
import { IconCheck, IconKeyboard, IconCash, IconBan } from '@tabler/icons-react';

interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

interface CompactInvoiceToolbarProps {
  isEditing?: boolean;
  originalInvNumber?: string | null;
  totals: InvoiceTotals;
  isTaxable: boolean;
  isSaving: boolean;
  hasLineItems: boolean;
  onIssueInvoice: () => void;
  onSaveAndPay: () => void;
  onOpenShortcuts: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export function CompactInvoiceToolbar({
  isEditing = false,
  originalInvNumber,
  totals,
  isTaxable,
  isSaving,
  hasLineItems,
  onIssueInvoice,
  onSaveAndPay,
  onOpenShortcuts,
}: CompactInvoiceToolbarProps) {
  // Editing an existing invoice down to zero line items cancels it.
  const isCancelling = isEditing && !hasLineItems;

  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 48 }}>
      <Group justify="space-between" wrap="nowrap" h="100%">
        {/* Left: Title */}
        <Text fw={600} size="lg">
          {isEditing ? `Edit Invoice ${originalInvNumber || ''}` : 'New Invoice'}
        </Text>

        {/* Center: Totals */}
        <Group gap="xl" wrap="nowrap">
          <Group gap={4}>
            <Text size="sm" c="dimmed">Subtotal:</Text>
            <Text size="sm" fw={600}>{formatCurrency(totals.subTotal)}</Text>
          </Group>
          {isTaxable && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Tax:</Text>
              <Text size="sm" fw={600}>{formatCurrency(totals.tax)}</Text>
            </Group>
          )}
          <Group gap={4}>
            <Text size="sm" c="dimmed">Total:</Text>
            <Text size="md" fw={700} c="blue">{formatCurrency(totals.total)}</Text>
          </Group>
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts (?)"
          >
            <IconKeyboard size={18} />
          </ActionIcon>
          <Button
            size="xs"
            color={isCancelling ? 'red' : 'green'}
            leftSection={isCancelling ? <IconBan size={14} /> : <IconCheck size={14} />}
            onClick={onIssueInvoice}
            loading={isSaving}
            disabled={!hasLineItems && !isCancelling}
          >
            {isCancelling ? 'Cancel Invoice' : 'Save & Issue'}
          </Button>
          <Button
            size="xs"
            color="teal"
            leftSection={<IconCash size={14} />}
            onClick={onSaveAndPay}
            loading={isSaving}
            disabled={!hasLineItems}
          >
            Save & Pay
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
