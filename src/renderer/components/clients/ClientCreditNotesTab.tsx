import { useState, useEffect, useMemo } from 'react';
import { Paper, Badge, Text, Group, Stack } from '@mantine/core';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';

interface CreditNote {
  id: number;
  crNumber: string;
  invNumber: string | null;
  crDate: string;
  total: string;
  totalUsed: string;
  status: string;
  isArchived: boolean;
}

interface ClientCreditNotesTabProps {
  clientId: number;
}

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function ClientCreditNotesTab({ clientId }: ClientCreditNotesTabProps) {
  const { openTab } = useTabContext();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_BY_CLIENT, { clientId });
        if (result.success && result.data) {
          setCreditNotes(result.data.filter((cn: CreditNote) => !cn.isArchived));
        }
      } catch (error) {
        console.error('Failed to load credit notes:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  const columns: Column<CreditNote>[] = useMemo(() => [
    {
      key: 'crNumber',
      header: 'CR #',
      width: 150,
      render: (cn) => <Text fw={500}>{cn.crNumber}</Text>,
    },
    {
      key: 'crDate',
      header: 'Date',
      width: 120,
      render: (cn) => formatDate(cn.crDate),
    },
    {
      key: 'invNumber',
      header: 'Invoice',
      width: 140,
      render: (cn) => (
        <Text size="sm" c={cn.invNumber ? undefined : 'dimmed'}>
          {cn.invNumber || '—'}
        </Text>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      width: 120,
      render: (cn) => <Text ta="right">{formatCurrency(cn.total)}</Text>,
    },
    {
      key: 'remaining',
      header: 'Remaining',
      width: 120,
      render: (cn) => {
        const remaining = parseFloat(cn.total) - parseFloat(cn.totalUsed);
        return (
          <Text ta="right" c={remaining > 0 ? 'green' : 'dimmed'}>
            {formatCurrency(remaining.toFixed(2))}
          </Text>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: 100,
      render: (cn) => {
        const color = cn.status === 'A' ? 'green' : 'gray';
        const label = cn.status === 'A' ? 'Active' : 'Used';
        return <Badge size="sm" variant="light" color={color}>{label}</Badge>;
      },
    },
  ], []);

  const totals = useMemo(() => {
    return creditNotes.reduce(
      (acc, cn) => {
        const total = parseFloat(cn.total) || 0;
        const used = parseFloat(cn.totalUsed) || 0;
        acc.issued += total;
        acc.available += Math.max(total - used, 0);
        return acc;
      },
      { issued: 0, available: 0 }
    );
  }, [creditNotes]);

  return (
    <Stack gap="md">
      <Group grow align="stretch">
        <Paper p="md" radius="md" withBorder>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Available Credit
            </Text>
            <Text size="xl" fw={700} c="green">
              {formatCurrency(totals.available.toFixed(2))}
            </Text>
            <Text size="xs" c="dimmed">
              Unused credit note value
            </Text>
          </Stack>
        </Paper>
        <Paper p="md" radius="md" withBorder>
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Total Issued
            </Text>
            <Text size="xl" fw={700}>
              {formatCurrency(totals.issued.toFixed(2))}
            </Text>
            <Text size="xs" c="dimmed">
              {creditNotes.length} credit note{creditNotes.length === 1 ? '' : 's'}
            </Text>
          </Stack>
        </Paper>
      </Group>

      <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={creditNotes}
        loading={loading}
        keyField="id"
        emptyMessage="No credit notes found for this client"
        minWidth={700}
        onRowClick={(cn) => openTab(`/credit-notes/${cn.id}`)}
      />
      </Paper>
    </Stack>
  );
}
