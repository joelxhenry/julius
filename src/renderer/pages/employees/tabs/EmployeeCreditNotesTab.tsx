import { useState, useEffect, useRef } from 'react';
import { Paper, Table, Text, Skeleton, Group, Pagination } from '@mantine/core';
import { IpcChannel } from '../../../../shared/types/ipc';
import { useTabContext } from '../../../contexts/TabContext';

interface Props {
  employeeId: number;
  isActive: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(amount);

export function EmployeeCreditNotesTab({ employeeId, isActive }: Props) {
  const { openTab } = useTabContext();
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
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
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_CREDIT_NOTES, {
        employeeId,
        page: p,
        pageSize: 10,
      });
      if (result.success && result.data) {
        setCreditNotes(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load credit notes:', err);
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
              <Table.Th>CR #</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Invoice #</Table.Th>
              <Table.Th>Client</Table.Th>
              <Table.Th>Total</Table.Th>
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
            ) : creditNotes.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No credit notes found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              creditNotes.map((cr) => (
                <Table.Tr key={cr.id} onClick={() => openTab(`/credit-notes/${cr.id}`)} style={{ cursor: 'pointer' }}>
                  <Table.Td><Text fw={500}>{cr.crNumber}</Text></Table.Td>
                  <Table.Td>{cr.crDate}</Table.Td>
                  <Table.Td>{cr.invNumber || '-'}</Table.Td>
                  <Table.Td>{cr.clientName || '-'}</Table.Td>
                  <Table.Td>{formatCurrency(parseFloat(cr.total || '0'))}</Table.Td>
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