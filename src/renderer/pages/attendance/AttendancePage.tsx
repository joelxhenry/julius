import { useState, useEffect, useCallback } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Center,
  Button,
  Group,
  Avatar,
  Badge,
  Table,
  Alert,
  RingProgress,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconClockPlay,
  IconClockStop,
  IconArrowLeft,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
import { PINInput } from '../../components/auth/PINInput';
import { IpcChannel } from '../../../shared/types/ipc';

type Phase = 'entry' | 'verified' | 'success';
type ActionType = 'in' | 'out';

interface SafeEmployee {
  id: number;
  code: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  status: string | null;
}

interface EmployeeShift {
  id: number;
  employeeId: number | null;
  shiftDate: string;
  clockInAt: string;       // ISO timestamp
  clockOutAt: string | null;
  notes: string | null;
  createdAt: string;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getInitials(employee: SafeEmployee): string {
  const f = employee.firstName?.[0] ?? '';
  const l = employee.lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

function getFullName(employee: SafeEmployee): string {
  return [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.code;
}

export function AttendancePage() {
  const [phase, setPhase] = useState<Phase>('entry');
  const [code, setCode] = useState('');
  const [employee, setEmployee] = useState<SafeEmployee | null>(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeShift, setActiveShift] = useState<EmployeeShift | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recentShifts, setRecentShifts] = useState<EmployeeShift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<ActionType | null>(null);
  const [countdown, setCountdown] = useState(5);

  // Live elapsed counter
  useEffect(() => {
    if (!isClockedIn || !activeShift?.clockInAt) return;
    const clockInMs = new Date(activeShift.clockInAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - clockInMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClockedIn, activeShift]);

  // Auto-return countdown after success
  useEffect(() => {
    if (phase !== 'success') return;
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          resetToEntry();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const resetToEntry = useCallback(() => {
    setPhase('entry');
    setCode('');
    setEmployee(null);
    setIsClockedIn(false);
    setActiveShift(null);
    setElapsed(0);
    setRecentShifts([]);
    setError(null);
    setLastAction(null);
  }, []);

  const loadRecentShifts = useCallback(async (employeeId: number) => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const start = new Date(today);
    start.setDate(start.getDate() - 14);
    const startDate = start.toISOString().split('T')[0];
    const res = await window.electron.invoke(IpcChannel.GET_SHIFTS_BY_DATE_RANGE, {
      startDate,
      endDate,
      employeeId,
    });
    setRecentShifts(Array.isArray(res?.data) ? res.data : []);
  }, []);

  const handleCodeSubmit = useCallback(async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const empRes = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_BY_CODE, { employeeCode: code.trim() });
      if (!empRes?.success || !empRes?.data) {
        setError('Invalid access code. Please try again.');
        setCode('');
        return;
      }
      const emp = empRes.data as SafeEmployee;

      if (emp.status !== 'active') {
        setError('This employee is not active and cannot clock in or out.');
        setCode('');
        return;
      }

      setEmployee(emp);

      const shiftRes = await window.electron.invoke(IpcChannel.GET_ACTIVE_SHIFT, { employeeId: emp.id });
      const shift = shiftRes?.data as EmployeeShift | null;
      if (shift) {
        setIsClockedIn(true);
        setActiveShift(shift);
        setElapsed(Math.floor((Date.now() - new Date(shift.clockInAt).getTime()) / 1000));
      } else {
        setIsClockedIn(false);
        setActiveShift(null);
        setElapsed(0);
      }

      await loadRecentShifts(emp.id);
      setPhase('verified');
    } catch (err: any) {
      setError(err?.message ?? 'An error occurred. Please try again.');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  }, [code, loadRecentShifts]);

  const handleClockIn = useCallback(async () => {
    if (!employee) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await window.electron.invoke(IpcChannel.CLOCK_IN_SHIFT, { employeeId: employee.id });
      if (!res?.success) {
        setError(res?.error ?? 'Failed to clock in. Please try again.');
        return;
      }
      const shift = res.data as EmployeeShift;
      setIsClockedIn(true);
      setActiveShift(shift);
      setElapsed(0);
      await loadRecentShifts(employee.id);
      setLastAction('in');
      setPhase('success');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to clock in. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }, [employee, loadRecentShifts]);

  const handleClockOut = useCallback(async () => {
    if (!employee) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await window.electron.invoke(IpcChannel.CLOCK_OUT_SHIFT, { employeeId: employee.id });
      if (!res?.success) {
        setError(res?.error ?? 'Failed to clock out. Please try again.');
        return;
      }
      setIsClockedIn(false);
      setActiveShift(null);
      setElapsed(0);
      await loadRecentShifts(employee.id);
      setLastAction('out');
      setPhase('success');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to clock out. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }, [employee, loadRecentShifts]);

  // ── Entry phase ──────────────────────────────────────────────────────────────
  if (phase === 'entry') {
    return (
      <Center h="100vh" style={{ alignItems: 'center' }}>
        <Stack align="center" gap="xl" w="100%" maw={380} px="md">
          <Stack align="center" gap="xs">
            <Title order={2} ta="center">Clock In / Out</Title>
            <Text c="dimmed" size="sm" ta="center">Enter your employee access code</Text>
          </Stack>

          <Paper withBorder p="xl" radius="md" w="100%">
            <Stack gap="md">
              {error && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                  {error}
                </Alert>
              )}
              <PINInput
                placeholder="Access code"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
                disabled={isLoading}
                autoFocus
              />
              <Button
                fullWidth
                size="lg"
                loading={isLoading}
                onClick={handleCodeSubmit}
                disabled={!code.trim()}
              >
                Continue
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Center>
    );
  }

  // ── Success phase ────────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <Center h="100vh">
        <Stack align="center" gap="xl" w="100%" maw={380} px="md">
          <RingProgress
            size={140}
            thickness={8}
            roundCaps
            sections={[{ value: (countdown / 5) * 100, color: lastAction === 'in' ? 'green' : 'red' }]}
            label={
              <Center>
                <Text size="xl" fw={700}>{countdown}</Text>
              </Center>
            }
          />
          <Stack align="center" gap="xs">
            <IconCheck size={32} color={lastAction === 'in' ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)'} />
            <Title order={3} ta="center">
              {lastAction === 'in' ? 'Clocked In Successfully' : 'Clocked Out Successfully'}
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Returning to home in {countdown}...
            </Text>
          </Stack>
          <Button variant="subtle" onClick={resetToEntry}>
            Done
          </Button>
        </Stack>
      </Center>
    );
  }

  // ── Verified phase ───────────────────────────────────────────────────────────
  return (
    <Center h="100vh" style={{ alignItems: 'flex-start', paddingTop: 48 }}>
      <Stack gap="lg" w="100%" maw={520} px="md">
        {/* Employee header */}
        <Paper withBorder p="lg" radius="md">
          <Group justify="space-between" align="flex-start">
            <Group gap="md">
              <Avatar size={56} radius="xl" color="blue">
                {getInitials(employee!)}
              </Avatar>
              <Stack gap={4}>
                <Text fw={600} size="lg">{getFullName(employee!)}</Text>
                <Group gap="xs">
                  {employee?.title && <Badge variant="light" size="sm">{employee.title}</Badge>}
                  {employee?.department && (
                    <Text size="xs" c="dimmed">{employee.department}</Text>
                  )}
                </Group>
              </Stack>
            </Group>
            <Badge size="lg" variant="light" color={isClockedIn ? 'green' : 'gray'}>
              {isClockedIn ? 'Clocked In' : 'Clocked Out'}
            </Badge>
          </Group>
        </Paper>

        {/* Error */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {/* Live counter */}
        {isClockedIn && (
          <Paper withBorder p="lg" radius="md" bg="green.0">
            <Stack align="center" gap={4}>
              <Text size="sm" c="green.7" fw={500}>Time Elapsed</Text>
              <Text size="2.5rem" fw={700} ff="monospace" c="green.8" lh={1}>
                {formatElapsed(elapsed)}
              </Text>
            </Stack>
          </Paper>
        )}

        {/* Clock In / Out action */}
        <Paper withBorder p="lg" radius="md">
          {isClockedIn ? (
            <Button
              fullWidth
              size="xl"
              color="red"
              leftSection={<IconClockStop size={24} />}
              loading={actionLoading}
              onClick={handleClockOut}
            >
              Clock Out
            </Button>
          ) : (
            <Button
              fullWidth
              size="xl"
              color="green"
              leftSection={<IconClockPlay size={24} />}
              loading={actionLoading}
              onClick={handleClockIn}
            >
              Clock In
            </Button>
          )}
        </Paper>

        {/* Recent shifts */}
        {recentShifts.length > 0 && (
          <Paper withBorder p="lg" radius="md">
            <Stack gap="sm">
              <Text fw={600} size="sm">Recent Attendance</Text>
              <Divider />
              <Box style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withColumnBorders={false} fz="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Clock In</Table.Th>
                      <Table.Th>Clock Out</Table.Th>
                      <Table.Th>Duration</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {recentShifts.slice(0, 10).map((shift) => {
                      const durationMs =
                        shift.clockInAt && shift.clockOutAt
                          ? new Date(shift.clockOutAt).getTime() - new Date(shift.clockInAt).getTime()
                          : null;
                      return (
                        <Table.Tr key={shift.id}>
                          <Table.Td>
                            <Text size="sm">
                              {new Date(shift.shiftDate + 'T00:00:00').toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" c="green.7" fw={500}>
                              {formatTime(shift.clockInAt)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {shift.clockOutAt ? (
                              <Text size="sm" c="red.7" fw={500}>
                                {formatTime(shift.clockOutAt)}
                              </Text>
                            ) : (
                              <Text size="sm" c="teal.6" fw={500}>Active</Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {durationMs ? (
                              <Text size="sm" c="dimmed">{formatDuration(durationMs)}</Text>
                            ) : (
                              <Text size="sm" c="dimmed">-</Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* Back */}
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={resetToEntry}
          size="sm"
        >
          Back
        </Button>
      </Stack>
    </Center>
  );
}
