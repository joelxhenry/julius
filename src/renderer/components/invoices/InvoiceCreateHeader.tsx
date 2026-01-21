import { Paper, Group, Stack, Title, Text, Button, ActionIcon } from '@mantine/core';
import { IconCheck, IconKeyboard, IconCash } from '@tabler/icons-react';

interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

interface InvoiceCreateHeaderProps {
  isEditing: boolean;
  originalInvNumber: string | null;
  salespersonName: string;
  clientName: string | null;
  totals: InvoiceTotals;
  isTaxable: boolean;
  isSaving: boolean;
  hasLineItems: boolean;
  onOpenShortcuts: () => void;
  onIssueInvoice: () => void;
  onSaveAndPay: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export function InvoiceCreateHeader({
  isEditing,
  originalInvNumber,
  salespersonName,
  clientName,
  totals,
  isTaxable,
  isSaving,
  hasLineItems,
  onOpenShortcuts,
  onIssueInvoice,
  onSaveAndPay,
}: InvoiceCreateHeaderProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" wrap="nowrap">
        {/* Left: Invoice Info */}
        <Group gap="lg" wrap="nowrap">
          <Stack gap={2}>
            <Title order={3}>
              {isEditing ? `Edit Invoice ${originalInvNumber || ''}` : 'New Invoice'}
            </Title>
            <Group gap="xs">
              {salespersonName && (
                <Text size="sm" c="dimmed">Salesperson: {salespersonName}</Text>
              )}
              {clientName && (
                <>
                  {salespersonName && <Text size="sm" c="dimmed">•</Text>}
                  <Text size="sm" c="dimmed">{clientName}</Text>
                </>
              )}
            </Group>
          </Stack>
        </Group>

        {/* Center: Summary Totals */}
        <Group gap="xl" wrap="nowrap">
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase">Subtotal</Text>
            <Text size="lg" fw={600}>{formatCurrency(totals.subTotal)}</Text>
          </Stack>
          {isTaxable && (
            <Stack gap={0} align="center">
              <Text size="xs" c="dimmed" tt="uppercase">Tax</Text>
              <Text size="lg" fw={600}>{formatCurrency(totals.tax)}</Text>
            </Stack>
          )}
          <Stack gap={0} align="center">
            <Text size="xs" c="dimmed" tt="uppercase">Total</Text>
            <Text size="xl" fw={700} c="blue">{formatCurrency(totals.total)}</Text>
          </Stack>
        </Group>

        {/* Right: Actions */}
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            onClick={onOpenShortcuts}
            title="Keyboard Shortcuts"
          >
            <IconKeyboard size={20} />
          </ActionIcon>
          <Button
            size="sm"
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={onIssueInvoice}
            loading={isSaving}
            disabled={!hasLineItems}
          >
            Save & Issue
          </Button>
          <Button
            size="sm"
            color="teal"
            leftSection={<IconCash size={16} />}
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
