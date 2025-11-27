import { Paper, Group, Text, Stack, Divider } from '@mantine/core';
import numeral from 'numeral';

interface InvoiceTotalsPanelProps {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  balance?: number;
  showBalance?: boolean;
}

export function InvoiceTotalsPanel({
  subtotal,
  discountTotal,
  taxTotal,
  total,
  balance,
  showBalance = false,
}: InvoiceTotalsPanelProps) {
  return (
    <Paper withBorder p="md" style={{ maxWidth: 400, marginLeft: 'auto' }}>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm">Subtotal:</Text>
          <Text size="sm">{numeral(subtotal).format('$0,0.00')}</Text>
        </Group>

        {discountTotal > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="red">
              Discount:
            </Text>
            <Text size="sm" c="red">
              -{numeral(discountTotal).format('$0,0.00')}
            </Text>
          </Group>
        )}

        <Group justify="space-between">
          <Text size="sm">Tax:</Text>
          <Text size="sm">{numeral(taxTotal).format('$0,0.00')}</Text>
        </Group>

        <Divider />

        <Group justify="space-between">
          <Text fw={700} size="lg">
            Total:
          </Text>
          <Text fw={700} size="lg">
            {numeral(total).format('$0,0.00')}
          </Text>
        </Group>

        {showBalance && balance !== undefined && (
          <>
            <Divider />
            <Group justify="space-between">
              <Text fw={600} c={balance > 0 ? 'orange' : 'green'}>
                Balance Due:
              </Text>
              <Text fw={600} c={balance > 0 ? 'orange' : 'green'}>
                {numeral(balance).format('$0,0.00')}
              </Text>
            </Group>
          </>
        )}
      </Stack>
    </Paper>
  );
}
