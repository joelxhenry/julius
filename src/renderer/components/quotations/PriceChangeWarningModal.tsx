import { Modal, Stack, Text, Alert, Table, Badge, Button, Group } from '@mantine/core';
import { IconAlertTriangle, IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';

export interface PriceChange {
  sku: string;
  description: string | null;
  quantity: number;
  quotedUnitPrice: number;
  currentUnitPrice: number;
}

interface PriceChangeWarningModalProps {
  opened: boolean;
  onClose: () => void;
  changes: PriceChange[];
  quoteNum: string;
  onConfirm: () => void;
  loading?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function PriceChangeWarningModal({
  opened,
  onClose,
  changes,
  quoteNum,
  onConfirm,
  loading = false,
}: PriceChangeWarningModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Price Changes Detected"
      size="xl"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Prices have changed since this quotation was created">
          <Text size="sm">
            {changes.length} item{changes.length === 1 ? '' : 's'} on quote {quoteNum} now {changes.length === 1 ? 'has' : 'have'} a
            different price in inventory. The invoice will be created using the current prices shown below.
          </Text>
        </Alert>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Part Number</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th ta="right">Quoted</Table.Th>
              <Table.Th ta="right">Current</Table.Th>
              <Table.Th ta="right">Change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {changes.map((c) => {
              const delta = c.currentUnitPrice - c.quotedUnitPrice;
              const increased = delta > 0;
              const pct = c.quotedUnitPrice !== 0 ? (delta / c.quotedUnitPrice) * 100 : 0;
              return (
                <Table.Tr key={c.sku}>
                  <Table.Td>
                    <Text size="sm" fw={500}>{c.sku}</Text>
                    <Text size="xs" c="dimmed">Qty: {c.quantity}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{c.description || '-'}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm">{formatCurrency(c.quotedUnitPrice)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="sm" fw={500}>{formatCurrency(c.currentUnitPrice)}</Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Badge
                      color={increased ? 'red' : 'green'}
                      variant="light"
                      leftSection={increased ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
                    >
                      {increased ? '+' : ''}{formatCurrency(delta)} ({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        <Group justify="flex-end" mt="md" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="green" onClick={onConfirm} loading={loading}>
            Update Prices &amp; Convert
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
