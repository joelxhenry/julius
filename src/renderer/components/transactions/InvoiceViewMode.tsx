import { Paper, Group, Text, Stack, Table, Divider, SimpleGrid, Badge, Box } from '@mantine/core';
import { IconUser, IconPhone, IconMail, IconMapPin, IconCalendar, IconClock } from '@tabler/icons-react';
import numeral from 'numeral';
import type { InvoiceLineItem } from './InvoiceLineItemsGrid';

interface ClientInfo {
  name: string;
  address1: string;
  address2: string;
  phone: string;
  email: string;
}

interface InvoiceViewModeProps {
  invoiceNumber: string;
  status: string;
  clientInfo: ClientInfo;
  issueDate: Date | null;
  dueDate: Date | null;
  notes: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  balance: number;
}

function formatDate(date: Date | null): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'PAID':
      return 'green';
    case 'PARTIAL':
      return 'orange';
    case 'ISSUED':
      return 'blue';
    case 'OVERDUE':
      return 'red';
    case 'CANCELLED':
      return 'gray';
    default:
      return 'gray';
  }
}

export function InvoiceViewMode({
  invoiceNumber,
  status,
  clientInfo,
  issueDate,
  dueDate,
  notes,
  items,
  subtotal,
  discountTotal,
  taxTotal,
  total,
  balance,
}: InvoiceViewModeProps) {
  const validItems = items.filter((item) => item.partVariantId);

  return (
    <Stack gap="lg">
      {/* Header with Invoice Number and Status */}
      <Paper withBorder p="lg">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
              Invoice
            </Text>
            <Text size="xl" fw={700}>
              #{invoiceNumber}
            </Text>
          </Box>
          <Badge size="lg" variant="light" color={getStatusColor(status)}>
            {status}
          </Badge>
        </Group>
      </Paper>

      {/* Client and Date Information */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        {/* Client Info */}
        <Paper withBorder p="md">
          <Text size="sm" fw={600} c="dimmed" mb="sm">
            Bill To
          </Text>
          <Stack gap="xs">
            {clientInfo.name ? (
              <>
                <Group gap="xs">
                  <IconUser size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                  <Text fw={500}>{clientInfo.name}</Text>
                </Group>
                {clientInfo.phone && (
                  <Group gap="xs">
                    <IconPhone size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    <Text size="sm" c="dimmed">{clientInfo.phone}</Text>
                  </Group>
                )}
                {clientInfo.email && (
                  <Group gap="xs">
                    <IconMail size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    <Text size="sm" c="dimmed">{clientInfo.email}</Text>
                  </Group>
                )}
                {(clientInfo.address1 || clientInfo.address2) && (
                  <Group gap="xs" align="flex-start">
                    <IconMapPin size={16} style={{ color: 'var(--mantine-color-dimmed)', marginTop: 2 }} />
                    <Box>
                      {clientInfo.address1 && <Text size="sm" c="dimmed">{clientInfo.address1}</Text>}
                      {clientInfo.address2 && <Text size="sm" c="dimmed">{clientInfo.address2}</Text>}
                    </Box>
                  </Group>
                )}
              </>
            ) : (
              <Text c="dimmed" fs="italic">Walk-in Customer</Text>
            )}
          </Stack>
        </Paper>

        {/* Date Info */}
        <Paper withBorder p="md">
          <Text size="sm" fw={600} c="dimmed" mb="sm">
            Invoice Details
          </Text>
          <Stack gap="xs">
            <Group gap="xs">
              <IconCalendar size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="sm">
                <Text span c="dimmed">Issue Date: </Text>
                <Text span fw={500}>{formatDate(issueDate)}</Text>
              </Text>
            </Group>
            <Group gap="xs">
              <IconClock size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text size="sm">
                <Text span c="dimmed">Due Date: </Text>
                <Text span fw={500}>{formatDate(dueDate)}</Text>
              </Text>
            </Group>
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* Line Items Table */}
      <Paper withBorder p="md">
        <Text size="sm" fw={600} c="dimmed" mb="md">
          Line Items
        </Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Description</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Qty</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Unit Price</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Discount</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Tax</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {validItems.length > 0 ? (
              validItems.map((item, index) => (
                <Table.Tr key={item.id || index}>
                  <Table.Td>{item.partName || '-'}</Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>{item.quantity}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {numeral(item.unitPrice).format('$0,0.00')}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {parseFloat(item.discount) > 0 ? numeral(item.discount).format('$0,0.00') : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {parseFloat(item.taxRate) > 0 ? `${item.taxRate}%` : '-'}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right', fontWeight: 500 }}>
                    {numeral(item.lineTotal).format('$0,0.00')}
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" fs="italic">No line items</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Totals */}
      <Paper withBorder p="md" style={{ maxWidth: 400, marginLeft: 'auto' }}>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Subtotal</Text>
            <Text size="sm">{numeral(subtotal).format('$0,0.00')}</Text>
          </Group>

          {discountTotal > 0 && (
            <Group justify="space-between">
              <Text size="sm" c="red">Discount</Text>
              <Text size="sm" c="red">-{numeral(discountTotal).format('$0,0.00')}</Text>
            </Group>
          )}

          <Group justify="space-between">
            <Text size="sm" c="dimmed">Tax</Text>
            <Text size="sm">{numeral(taxTotal).format('$0,0.00')}</Text>
          </Group>

          <Divider my="xs" />

          <Group justify="space-between">
            <Text fw={700} size="lg">Total</Text>
            <Text fw={700} size="lg">{numeral(total).format('$0,0.00')}</Text>
          </Group>

          <Divider my="xs" />

          <Group justify="space-between">
            <Text fw={600} c={balance > 0 ? 'orange' : 'green'}>
              Balance Due
            </Text>
            <Text fw={600} size="lg" c={balance > 0 ? 'orange' : 'green'}>
              {numeral(balance).format('$0,0.00')}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Notes */}
      {notes && (
        <Paper withBorder p="md" bg="gray.0">
          <Text size="sm" fw={600} c="dimmed" mb="xs">
            Notes
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{notes}</Text>
        </Paper>
      )}
    </Stack>
  );
}
