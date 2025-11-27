import { Paper, Title, Table, Text, Group, Button, Skeleton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight } from '@tabler/icons-react';
import { StatusBadge } from '../common/StatusBadge';
import type { Invoice } from '../../../main/database/schema';
import numeral from 'numeral';

interface RecentInvoicesWidgetProps {
  invoices: Invoice[];
  loading?: boolean;
}

export function RecentInvoicesWidget({ invoices, loading = false }: RecentInvoicesWidgetProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Title order={4} mb="md">Recent Invoices</Title>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height={40} mb="xs" />
        ))}
      </Paper>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" mb="md">
        <Title order={4}>Recent Invoices</Title>
        <Button
          variant="subtle"
          size="xs"
          rightSection={<IconArrowRight size={14} />}
          onClick={() => navigate('/invoices')}
        >
          View All
        </Button>
      </Group>

      {invoices.length === 0 ? (
        <Text c="dimmed" size="sm" ta="center" py="xl">
          No recent invoices
        </Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Client</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invoices.slice(0, 5).map((invoice) => (
              <Table.Tr
                key={invoice.id}
                onClick={() => navigate(`/invoices/${invoice.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>#{invoice.legacyId}</Table.Td>
                <Table.Td>{invoice.clientId || 'Walk-in'}</Table.Td>
                <Table.Td>{numeral(parseFloat(invoice.total) || 0).format('$0,0.00')}</Table.Td>
                <Table.Td>
                  <StatusBadge status={invoice.status || 'DRAFT'} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}
