import { Paper, Box, Group, Text, Badge, Table, useMantineTheme, useMantineColorScheme } from '@mantine/core';
import { IconPackage } from '@tabler/icons-react';
import { CopyButton } from '../common';

interface LineItem {
  id: number;
  sku: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  amount: string;
  isTaxable: boolean;
}

interface InvoiceLineItemsReadOnlyProps {
  lineItems: LineItem[];
  subTotal: string;
  tax: string;
  total: string;
  selectedId?: number | null;
  onSelectItem?: (id: number) => void;
  compact?: boolean;
}

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

export function InvoiceLineItemsReadOnly({
  lineItems,
  subTotal,
  tax,
  total,
  selectedId,
  onSelectItem,
  compact = false,
}: InvoiceLineItemsReadOnlyProps) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const hasTax = parseFloat(tax) > 0;
  const rowHeight = compact ? 40 : 52;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Paper withBorder radius="md" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
          <Group justify="space-between">
            <Group gap="xs">
              <IconPackage size={18} style={{ color: 'var(--mantine-color-blue-6)' }} />
              <Text fw={600} size="md">Line Items</Text>
              <Badge variant="light" size="sm">{lineItems.length} items</Badge>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Subtotal: {formatCurrency(subTotal)}
              </Text>
              {hasTax && (
                <>
                  <Text size="sm" c="dimmed">•</Text>
                  <Text size="sm" c="dimmed">Tax: {formatCurrency(tax)}</Text>
                </>
              )}
            </Group>
          </Group>
        </Box>

      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 140 }}>SKU</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th style={{ width: 80, textAlign: 'center' }}>Qty</Table.Th>
              <Table.Th style={{ width: 120, textAlign: 'right' }}>Unit Price</Table.Th>
              <Table.Th style={{ width: 100, textAlign: 'right' }}>Discount</Table.Th>
              <Table.Th style={{ width: 120, textAlign: 'right' }}>Amount</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lineItems.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="xl">No line items found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              lineItems.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <Table.Tr
                    key={item.id}
                    onClick={() => onSelectItem?.(item.id)}
                    style={{
                      height: rowHeight,
                      backgroundColor: isSelected
                        ? colorScheme === 'dark'
                          ? theme.colors.blue[9]
                          : theme.colors.blue[1]
                        : undefined,
                      cursor: onSelectItem ? 'pointer' : 'default',
                      transition: 'background-color 0.1s ease',
                    }}
                  >
                    <Table.Td style={{ height: rowHeight }}>
                      <Group gap="xs">
                        <Text size={compact ? 'sm' : 'md'} fw={500}>{item.sku}</Text>
                        <CopyButton value={item.sku} />
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ height: rowHeight }}>
                      <Text size={compact ? 'sm' : 'md'} fw={compact ? 400 : 500} lineClamp={1}>
                        {item.description || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ height: rowHeight }}>
                      <Text size={compact ? 'sm' : 'md'} ta="center" fw={600}>{item.quantity}</Text>
                    </Table.Td>
                    <Table.Td style={{ height: rowHeight }}>
                      <Text size={compact ? 'sm' : 'md'} ta="right">{formatCurrency(item.unitPrice)}</Text>
                    </Table.Td>
                    <Table.Td style={{ height: rowHeight }}>
                      {parseFloat(item.discount) > 0 ? (
                        <Text size={compact ? 'sm' : 'md'} ta="right" c="red">
                          {item.discount}%
                        </Text>
                      ) : (
                        <Text size={compact ? 'sm' : 'md'} ta="right" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ height: rowHeight }}>
                      <Text size={compact ? 'sm' : 'md'} ta="right" fw={600}>{formatCurrency(item.amount)}</Text>
                    </Table.Td>
                </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
          {lineItems.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="right" fw={500}>Subtotal</Text>
                </Table.Td>
                <Table.Td>
                  <Text ta="right" fw={500}>{formatCurrency(subTotal)}</Text>
                </Table.Td>
              </Table.Tr>
              {hasTax && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="right" fw={500}>Tax</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text ta="right" fw={500}>{formatCurrency(tax)}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
              <Table.Tr style={{ backgroundColor: 'var(--mantine-color-blue-light)' }}>
                <Table.Td colSpan={5}>
                  <Text ta="right" fw={700} size="lg">Total</Text>
                </Table.Td>
                <Table.Td>
                  <Text ta="right" fw={700} size="lg">{formatCurrency(total)}</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
        </Table.ScrollContainer>
      </Paper>
    </Box>
  );
}
