import { Paper, Box, Group, Text, Badge, Table } from '@mantine/core';
import { IconPackage } from '@tabler/icons-react';

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
}: InvoiceLineItemsReadOnlyProps) {
  const hasTax = parseFloat(tax) > 0;

  return (
    <Paper withBorder radius="md">
      <Box p="md" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Group justify="space-between">
          <Group gap="xs">
            <IconPackage size={20} style={{ color: 'var(--mantine-color-blue-6)' }} />
            <Text fw={600} size="lg">Line Items</Text>
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
              lineItems.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Text size="sm" fw={500}>{item.sku}</Text>
                      <IconPackage size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>{item.description || '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="center" fw={500}>{item.quantity}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="right">{formatCurrency(item.unitPrice)}</Text>
                  </Table.Td>
                  <Table.Td>
                    {parseFloat(item.discount) > 0 ? (
                      <Text size="sm" ta="right" c="red">
                        {item.discount}%
                      </Text>
                    ) : (
                      <Text size="sm" ta="right" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="right" fw={600}>{formatCurrency(item.amount)}</Text>
                  </Table.Td>
                </Table.Tr>
              ))
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
  );
}
