import { useState, useEffect, useRef } from 'react';
import { Paper, Table, Badge, Text, Skeleton, Group, Pagination } from '@mantine/core';
import { IpcChannel } from '../../../../shared/types/ipc';
import { useTabContext } from '../../../contexts/TabContext';

interface Props {
  employeeId: number;
  isActive: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(amount);

export function EmployeeInvoicesTab({ employeeId, isActive }: Props) {
  const { openTab } = useTabContext();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (isActive && !hasLoaded.current) {
      hasLoaded.current = true;
      load(1);
    }
  }, [isActive]);

  useEffect(() => {
    if (hasLoaded.current) load(page);
  }, [page]);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_INVOICES, {
        employeeId,
        page: p,
        pageSize: 10,
      });
      if (result.success && result.data) {
        setInvoices(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="md" radius="md" withBorder>
      <Table.ScrollContainer minWidth={600}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Client</Table.Th>
              <Table.Th>Total</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Table.Tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                  ))}
                </Table.Tr>
              ))
            ) : invoices.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No invoices found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              invoices.map((inv) => (
                <Table.Tr
                  key={inv.id}
                  onClick={() => openTab(`/invoices/${inv.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td><Text fw={500}>{inv.invNumber}</Text></Table.Td>
                  <Table.Td>{inv.invDate}</Table.Td>
                  <Table.Td>{inv.clientName || '-'}</Table.Td>
                  <Table.Td>{formatCurrency(parseFloat(inv.total || '0'))}</Table.Td>
                  <Table.Td>
                    <Badge color={inv.status === 'A' ? 'green' : 'gray'} variant="light" size="sm">
                      {inv.status === 'A' ? 'Active' : inv.status}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
        </Group>
      )}
    </Paper>
  );
}