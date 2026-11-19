import { useEffect, useState } from 'react';
import { Paper, Table, Badge, Text, Skeleton, Group, Pagination, Select } from '@mantine/core';
import dayjs from 'dayjs';
import { IpcChannel } from '../../../shared/types/ipc';

interface UserSessionRow {
  id: number;
  employeeId: number | null;
  employeeName: string | null;
  username: string | null;
  loginAt: string;
  logoutAt: string | null;
  logoutReason: string | null;
}

function formatDuration(loginAt: string, logoutAt: string | null): string {
  const end = logoutAt ? dayjs(logoutAt) : dayjs();
  const minutes = end.diff(dayjs(loginAt), 'minute');
  if (minutes < 1) return '< 1 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function UserActivityTab() {
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load(1, statusFilter);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    load(page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const load = async (p: number, status: string | null) => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_USER_SESSIONS, {
        page: p,
        pageSize: 20,
        activeOnly: status === 'active' ? true : undefined,
      });
      if (result.success && result.data) {
        setSessions(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load user activity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={500}>Login / Logout History</Text>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: 'all', label: 'All sessions' },
            { value: 'active', label: 'Currently signed in' },
          ]}
          size="sm"
          w={200}
        />
      </Group>
      <Table.ScrollContainer minWidth={700}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Login Time</Table.Th>
              <Table.Th>Logout Time</Table.Th>
              <Table.Th>Duration</Table.Th>
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
            ) : sessions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No login activity recorded yet</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              sessions.map((session) => (
                <Table.Tr key={session.id}>
                  <Table.Td>
                    <Text fw={500}>{session.employeeName || session.username || '-'}</Text>
                  </Table.Td>
                  <Table.Td>{dayjs(session.loginAt).format('MMM D, YYYY h:mm A')}</Table.Td>
                  <Table.Td>
                    {session.logoutAt ? dayjs(session.logoutAt).format('MMM D, YYYY h:mm A') : '-'}
                  </Table.Td>
                  <Table.Td>{formatDuration(session.loginAt, session.logoutAt)}</Table.Td>
                  <Table.Td>
                    {session.logoutAt ? (
                      <Badge color="gray" variant="light" size="sm">
                        {session.logoutReason === 'idle_timeout' ? 'Idle timeout' : 'Signed out'}
                      </Badge>
                    ) : (
                      <Badge color="green" variant="light" size="sm">Active</Badge>
                    )}
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
