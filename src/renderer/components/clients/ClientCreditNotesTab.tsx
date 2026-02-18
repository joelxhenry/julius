import { useState, useEffect, useMemo } from 'react';
import { Paper, Badge, Text } from '@mantine/core';
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
          setCreditNotes(result.data);
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
        const effectiveStatus = cn.isArchived ? 'archived' : cn.status;
        const color = effectiveStatus === 'A' ? 'green' : effectiveStatus === 'U' ? 'gray' : 'gray';
        const label = effectiveStatus === 'A' ? 'Active' : effectiveStatus === 'U' ? 'Used' : 'Archived';
        return <Badge size="sm" variant="light" color={color}>{label}</Badge>;
      },
    },
  ], []);

  return (
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
  );
}
