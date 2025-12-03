import { Card, Stack, Text, Group, Divider, Button } from '@mantine/core';
import { IconDeviceFloppy, IconCheck } from '@tabler/icons-react';
import { useTaxRate } from '../../hooks/index';

interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

interface InvoiceSummaryCardProps {
  lineItemCount: number;
  totals: InvoiceTotals;
  isTaxable: boolean;
  isSaving: boolean;
  hasLineItems: boolean;
  formatCurrency: (value: number) => string;
  onSaveDraft: () => void;
  onIssueInvoice: () => void;
}

export function InvoiceSummaryCard({
  lineItemCount,
  totals,
  isTaxable,
  isSaving,
  hasLineItems,
  formatCurrency,
  onSaveDraft,
  onIssueInvoice,
}: InvoiceSummaryCardProps) {


  const { taxRate } = useTaxRate();


  return (
    <Card withBorder p="md" radius="md" pos="sticky" top={20}>
      <Stack gap="md">
        <Text fw={600}>Summary</Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Items
            </Text>
            <Text size="sm">{lineItemCount}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Subtotal
            </Text>
            <Text size="sm">{formatCurrency(totals.subTotal)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Tax ({isTaxable ? `${(taxRate * 100)}%` : '0%'})
            </Text>
            <Text size="sm">{formatCurrency(totals.tax)}</Text>
          </Group>
          <Divider />
          <Group justify="space-between">
            <Text fw={600}>Total</Text>
            <Text fw={600} size="lg">
              {formatCurrency(totals.total)}
            </Text>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Button
            fullWidth
            variant="light"
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={onSaveDraft}
            loading={isSaving}
          >
            Save as Draft
          </Button>
          <Button
            fullWidth
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={onIssueInvoice}
            loading={isSaving}
            disabled={!hasLineItems}
          >
            Save & Issue
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
