import { useEffect, useState } from 'react';
import { Paper, Table, Badge, Text, Skeleton, Group, Pagination, Select, Button, Modal, Code, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

interface ErrorLogRow {
  id: number;
  source: string;
  context: string | null;
  userMessage: string;
  technicalMessage: string;
  stack: string | null;
  errorCode: string | null;
  employeeName: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export function ErrorLogsTab() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ErrorLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>('open');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ErrorLogRow | null>(null);

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
      const result = await window.electron.invoke(IpcChannel.GET_ERROR_LOGS, {
        page: p,
        pageSize: 20,
        resolved: status === 'open' ? false : status === 'resolved' ? true : undefined,
      });
      if (result.success && result.data) {
        setLogs(result.data.data);
        setTotalPages(result.data.totalPages);
      } else {
        notifications.show({ title: 'Error', message: result.error || 'Failed to load error logs', color: 'red' });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to load error logs',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (log: ErrorLogRow) => {
    try {
      const result = await window.electron.invoke(IpcChannel.MARK_ERROR_LOG_RESOLVED, {
        id: log.id,
        resolvedBy: user?.username || 'Unknown',
      });
      if (result.success) {
        notifications.show({ title: 'Resolved', message: 'Error log marked as resolved', color: 'green' });
        setSelected(null);
        load(page, statusFilter);
      } else {
        notifications.show({ title: 'Error', message: result.error || 'Failed to resolve error log', color: 'red' });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to resolve error log',
        color: 'red',
      });
    }
  };

  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <Text fw={500}>System Error Log</Text>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: 'all', label: 'All errors' },
            { value: 'open', label: 'Open' },
            { value: 'resolved', label: 'Resolved' },
          ]}
          size="sm"
          w={180}
        />
      </Group>
      <Table.ScrollContainer minWidth={800}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Time</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th>Message</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
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
            ) : logs.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="xl">No errors recorded</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              logs.map((log) => (
                <Table.Tr key={log.id}>
                  <Table.Td>{dayjs(log.createdAt).format('MMM D, YYYY h:mm A')}</Table.Td>
                  <Table.Td>
                    <Badge color="gray" variant="light" size="sm">{log.source}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>{log.userMessage}</Text>
                  </Table.Td>
                  <Table.Td>
                    {log.resolved ? (
                      <Badge color="gray" variant="light" size="sm">Resolved</Badge>
                    ) : (
                      <Badge color="red" variant="light" size="sm">Open</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button variant="subtle" size="xs" onClick={() => setSelected(log)}>
                      Details
                    </Button>
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

      <Modal opened={!!selected} onClose={() => setSelected(null)} title="Error Details" size="lg">
        {selected && (
          <Stack gap="sm">
            <Group gap="xs">
              <Badge color="gray" variant="light">{selected.source}</Badge>
              {selected.context && <Badge color="blue" variant="light">{selected.context}</Badge>}
              {selected.errorCode && <Badge color="orange" variant="light">code {selected.errorCode}</Badge>}
            </Group>
            <Text size="sm" c="dimmed">{dayjs(selected.createdAt).format('MMM D, YYYY h:mm:ss A')}</Text>
            <div>
              <Text size="sm" fw={600} mb={4}>Shown to user</Text>
              <Text size="sm">{selected.userMessage}</Text>
            </div>
            <div>
              <Text size="sm" fw={600} mb={4}>Technical message</Text>
              <Code block>{selected.technicalMessage}</Code>
            </div>
            {selected.stack && (
              <div>
                <Text size="sm" fw={600} mb={4}>Stack trace</Text>
                <Code block style={{ maxHeight: 240, overflow: 'auto' }}>{selected.stack}</Code>
              </div>
            )}
            {selected.resolved ? (
              <Text size="sm" c="dimmed">
                Resolved by {selected.resolvedBy || 'Unknown'} on{' '}
                {selected.resolvedAt ? dayjs(selected.resolvedAt).format('MMM D, YYYY h:mm A') : '-'}
              </Text>
            ) : (
              <Group justify="flex-end">
                <Button size="sm" onClick={() => handleResolve(selected)}>Mark Resolved</Button>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </Paper>
  );
}
