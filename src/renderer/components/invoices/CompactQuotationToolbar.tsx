import { Group, Text, Button, ActionIcon, Paper } from '@mantine/core';
import { IconDeviceFloppy, IconKeyboard } from '@tabler/icons-react';

interface QuotationTotals {
  subTotal: number;
  tax: number;
  total: number;
}

interface CompactQuotationToolbarProps {
  isEditing?: boolean;
  originalQuoteNum?: string | null;
  totals: QuotationTotals;
  isTaxable: boolean;
  isSaving: boolean;
  hasLineItems: boolean;
  onSave: () => void;
  onOpenShortcuts: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export function CompactQuotationToolbar({
  isEditing = false,
  originalQuoteNum,
  totals,
  isTaxable,
  isSaving,
  hasLineItems,
  onSave,
  onOpenShortcuts,
}: CompactQuotationToolbarProps) {
  return (
    <Paper withBorder p="xs" radius="md" style={{ height: 48 }}>
      <Group justify="space-between" wrap="nowrap" h="100%">
        {/* Left: Title */}
        <Text fw={600} size="lg" c="violet">
          {isEditing ? `Edit Quotation ${originalQuoteNum || ''}` : 'New Quotation'}
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
            <Text size="md" fw={700} c="violet">{formatCurrency(totals.total)}</Text>
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
            color="violet"
            leftSection={<IconDeviceFloppy size={14} />}
            onClick={onSave}
            loading={isSaving}
            disabled={!hasLineItems}
          >
            Save Quotation
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
