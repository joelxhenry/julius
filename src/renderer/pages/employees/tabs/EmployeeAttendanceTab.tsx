import { useState, useEffect, useRef } from 'react';
import { Paper, Table, Badge, Text, Skeleton, Group, Pagination } from '@mantine/core';
import { IpcChannel } from '../../../../shared/types/ipc';

interface Props {
  employeeId: number;
  isActive: boolean;
}

export function EmployeeAttendanceTab({ employeeId, isActive }: Props) {
  const [attendance, setAttendance] = useState<any[]>([]);
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
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_ATTENDANCE, {
        employeeId,
        page: p,
        pageSize: 10,
      });
      if (result.success && result.data) {
        setAttendance(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
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
              <Table.Th>Type</Table.Th>
              <Table.Th>In Time</Table.Th>
              <Table.Th>Out Time</Table.Th>
              <Table.Th>Description</Table.Th>
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
            ) : attendance.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No attendance records found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              attendance.map((record) => (
                <Table.Tr key={record.id}>
                  <Table.Td>{record.logDate}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">{record.logType}</Badge>
                  </Table.Td>
                  <Table.Td>{record.inTime1 || record.activityTime || '-'}</Table.Td>
                  <Table.Td>{record.outTime1 || '-'}</Table.Td>
                  <Table.Td>{record.activityDesc || '-'}</Table.Td>
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