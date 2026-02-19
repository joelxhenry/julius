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

export function EmployeePaymentsTab({ employeeId, isActive }: Props) {
  const { openTab } = useTabContext();
  const [payments, setPayments] = useState<any[]>([]);
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
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_PAYMENTS, {
        employeeId,
        page: p,
        pageSize: 10,
      });
      if (result.success && result.data) {
        setPayments(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load payments:', err);
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
              <Table.Th>Date</Table.Th>
              <Table.Th>Document</Table.Th>
              <Table.Th>Payer</Table.Th>
              <Table.Th>Description</Table.Th>
              <Table.Th>Amount</Table.Th>
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
            ) : payments.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No payments found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              payments.map((payment) => (
                <Table.Tr key={payment.id} onClick={() => openTab(`/payments/${payment.id}`)} style={{ cursor: 'pointer' }}>
                  <Table.Td>{payment.paymentDate || '-'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">{payment.documentType}</Badge>
                    {' '}{payment.documentNumber}
                  </Table.Td>
                  <Table.Td>{payment.payerName || '-'}</Table.Td>
                  <Table.Td>{payment.paymentDesc || '-'}</Table.Td>
                  <Table.Td>{formatCurrency(parseFloat(payment.amount || '0'))}</Table.Td>
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