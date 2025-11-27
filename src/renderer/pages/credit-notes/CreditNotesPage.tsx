import { Title, Group, Button, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconReceipt } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useCreditNotes } from '../../hooks';
import type { CreditNote } from '../../../main/database/schema';
import numeral from 'numeral';

export function CreditNotesPage() {
  const navigate = useNavigate();
  const { creditNotes, loading } = useCreditNotes();

  const columns: ColumnDef<CreditNote>[] = [
    {
      key: 'legacyId',
      title: 'Credit Note #',
      sortable: true,
      width: 140,
      render: (value) => `#${value}`
    },
    {
      key: 'invoiceId',
      title: 'Invoice #',
      sortable: true,
      width: 120,
      render: (value) => value ? `#${value}` : 'N/A',
    },
    {
      key: 'clientId',
      title: 'Client',
      sortable: true,
      render: (value) => value || 'Walk-in'
    },
    {
      key: 'createdAt',
      title: 'Date',
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'amount',
      title: 'Amount',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'balance',
      title: 'Balance',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value || 'DRAFT'} />,
    },
    {
      key: 'reason',
      title: 'Reason',
      render: (value) => value || '-',
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconReceipt size={32} />
          <Title order={2}>Credit Notes</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/credit-notes/new')}
        >
          New Credit Note
        </Button>
      </Group>

      <DataTable
        data={creditNotes}
        columns={columns}
        loading={loading}
        onRowClick={(creditNote) => navigate(`/credit-notes/${creditNote.id}`)}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
