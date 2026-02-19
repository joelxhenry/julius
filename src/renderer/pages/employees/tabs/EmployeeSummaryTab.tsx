import { useState, useEffect, useRef } from 'react';
import { Card, SimpleGrid, Skeleton, Text } from '@mantine/core';
import { IpcChannel } from '../../../../shared/types/ipc';

interface ActivitySummary {
  invoices: { count: number; totalAmount: number };
  quotations: { count: number; totalAmount: number };
  creditNotes: { count: number; totalAmount: number };
  payments: { count: number; totalAmount: number };
  attendance: { totalDays: number };
}

interface Props {
  employeeId: number;
  isActive: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(amount);

export function EmployeeSummaryTab({ employeeId, isActive }: Props) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
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
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_ACTIVITY_SUMMARY, { employeeId });
      if (result.success && result.data) setSummary(result.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={100} radius="md" />
        ))}
      </SimpleGrid>
    );
  }

  if (!summary) return <Text c="dimmed">No activity data available</Text>;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
      <Card withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Invoices</Text>
        <Text size="xl" fw={700}>{summary.invoices.count}</Text>
        <Text size="sm" c="dimmed">{formatCurrency(summary.invoices.totalAmount)}</Text>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Quotations</Text>
        <Text size="xl" fw={700}>{summary.quotations.count}</Text>
        <Text size="sm" c="dimmed">{formatCurrency(summary.quotations.totalAmount)}</Text>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Credit Notes</Text>
        <Text size="xl" fw={700}>{summary.creditNotes.count}</Text>
        <Text size="sm" c="dimmed">{formatCurrency(summary.creditNotes.totalAmount)}</Text>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Payments Processed</Text>
        <Text size="xl" fw={700}>{summary.payments.count}</Text>
        <Text size="sm" c="dimmed">{formatCurrency(summary.payments.totalAmount)}</Text>
      </Card>
      <Card withBorder radius="md" p="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Attendance</Text>
        <Text size="xl" fw={700}>{summary.attendance.totalDays}</Text>
        <Text size="sm" c="dimmed">days recorded</Text>
      </Card>
    </SimpleGrid>
  );
}