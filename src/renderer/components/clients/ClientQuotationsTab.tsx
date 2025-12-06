import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Badge, Text, ActionIcon } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  total: string;
  status: string;
  expiryDate: string | null;
  createdAt: string;
}

interface ClientQuotationsTabProps {
  clientId: number;
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  accepted: 'green',
  rejected: 'red',
  expired: 'orange',
  converted: 'purple',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function ClientQuotationsTab({ clientId }: ClientQuotationsTabProps) {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotations();
  }, [clientId]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_BY_CLIENT, { clientId });
      if (result.success && result.data) {
        setQuotations(result.data);
      }
    } catch (error) {
      console.error('Failed to load quotations:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Quotation>[] = useMemo(
    () => [
      {
        key: 'quoteNum',
        header: 'Quotation #',
        width: 150,
        render: (quotation) => <Text fw={500}>{quotation.quoteNum}</Text>,
      },
      {
        key: 'quoteDate',
        header: 'Date',
        width: 120,
        render: (quotation) => formatDate(quotation.quoteDate),
      },
      {
        key: 'expiryDate',
        header: 'Expiry Date',
        width: 120,
        render: (quotation) => formatDate(quotation.expiryDate),
      },
      {
        key: 'total',
        header: 'Total',
        width: 120,
        render: (quotation) => <Text ta="right">{formatCurrency(quotation.total)}</Text>,
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (quotation) => (
          <Badge color={statusColors[quotation.status] || 'gray'} variant="light">
            {statusLabels[quotation.status] || quotation.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (quotation) => (
          <ActionIcon variant="subtle" onClick={() => navigate(`/quotations/${quotation.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        ),
      },
    ],
    [navigate]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={quotations}
        loading={loading}
        keyField="id"
        emptyMessage="No quotations found for this client"
        minWidth={700}
        onRowClick={(quotation) => navigate(`/quotations/${quotation.id}`)}
        stickyActionsColumn
      />
    </Paper>
  );
}
