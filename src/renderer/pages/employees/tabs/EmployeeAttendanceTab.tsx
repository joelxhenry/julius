import { useState, useEffect, useRef } from 'react';
import {
  Paper,
  Table,
  Badge,
  Text,
  Skeleton,
  Group,
  Stack,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { IconClock, IconCalendar, IconClockHour4 } from '@tabler/icons-react';
import { IpcChannel } from '../../../../shared/types/ipc';

interface Props {
  employeeId: number;
  isActive: boolean;
}

interface EmployeeShift {
  id: number;
  employeeId: number | null;
  shiftDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  notes: string | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getMonthBounds(): { start: string; end: string } {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
  };
}

function computeStats(shifts: EmployeeShift[], start: string, end: string) {
  const inRange = shifts.filter((s) => s.shiftDate >= start && s.shiftDate <= end);
  const daysPresent = new Set(inRange.map((s) => s.shiftDate)).size;
  let totalMs = 0;
  for (const s of inRange) {
    if (s.clockInAt && s.clockOutAt) {
      totalMs += new Date(s.clockOutAt).getTime() - new Date(s.clockInAt).getTime();
    }
  }
  return { daysPresent, totalHours: totalMs / 3_600_000 };
}

interface StatCardProps {
  label: string;
  icon: React.ReactNode;
  days: number;
  hours: number;
  loading: boolean;
}

function StatCard({ label, icon, days, hours, loading }: StatCardProps) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group gap="xs">
          {icon}
          <Text size="sm" c="dimmed" fw={500}>{label}</Text>
        </Group>
        <Divider />
        {loading ? (
          <>
            <Skeleton height={24} width="60%" />
            <Skeleton height={16} width="40%" />
          </>
        ) : (
          <>
            <Text size="xl" fw={700}>{hours > 0 ? formatHours(hours) : '-'}</Text>
            <Text size="xs" c="dimmed">{days} day{days !== 1 ? 's' : ''} present</Text>
          </>
        )}
      </Stack>
    </Paper>
  );
}

export function EmployeeAttendanceTab({ employeeId, isActive }: Props) {
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (isActive && !hasLoaded.current) {
      hasLoaded.current = true;
      load();
    }
  }, [isActive]);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const endDate = today.toISOString().split('T')[0];
      const start = new Date(today);
      start.setDate(start.getDate() - 60);
      const startDate = start.toISOString().split('T')[0];

      const res = await window.electron.invoke(IpcChannel.GET_SHIFTS_BY_DATE_RANGE, {
        startDate,
        endDate,
        employeeId,
      });
      if (res?.success && Array.isArray(res.data)) {
        setShifts(res.data);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  const week = getWeekBounds();
  const month = getMonthBounds();
  const weekStats = computeStats(shifts, week.start, week.end);
  const monthStats = computeStats(shifts, month.start, month.end);

  const recentShifts = [...shifts]
    .sort((a, b) => new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime())
    .slice(0, 30);

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <StatCard
          label="This Week"
          icon={<IconClock size={16} color="var(--mantine-color-blue-6)" />}
          days={weekStats.daysPresent}
          hours={weekStats.totalHours}
          loading={loading}
        />
        <StatCard
          label="This Month"
          icon={<IconCalendar size={16} color="var(--mantine-color-violet-6)" />}
          days={monthStats.daysPresent}
          hours={monthStats.totalHours}
          loading={loading}
        />
      </SimpleGrid>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconClockHour4 size={16} color="var(--mantine-color-gray-6)" />
            <Text size="sm" fw={600}>Recent Shifts</Text>
          </Group>
          <Table.ScrollContainer minWidth={500}>
            <Table striped highlightOnHover fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Clock In</Table.Th>
                  <Table.Th>Clock Out</Table.Th>
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
                ) : recentShifts.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed" ta="center" py="xl">No attendance records found</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  recentShifts.map((shift) => {
                    const durationMs =
                      shift.clockInAt && shift.clockOutAt
                        ? new Date(shift.clockOutAt).getTime() - new Date(shift.clockInAt).getTime()
                        : null;
                    const active = !shift.clockOutAt;
                    return (
                      <Table.Tr key={shift.id}>
                        <Table.Td>
                          {new Date(shift.shiftDate + 'T00:00:00').toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Table.Td>
                        <Table.Td>
                          <Text c="green.7" fw={500} size="sm">{formatTime(shift.clockInAt)}</Text>
                        </Table.Td>
                        <Table.Td>
                          {shift.clockOutAt ? (
                            <Text c="red.7" fw={500} size="sm">{formatTime(shift.clockOutAt)}</Text>
                          ) : (
                            <Text c="dimmed" size="sm">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Text c="dimmed" size="sm">
                            {durationMs != null ? formatDuration(durationMs) : '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" size="sm" color={active ? 'teal' : 'gray'}>
                            {active ? 'Active' : 'Completed'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Paper>
    </Stack>
  );
}
