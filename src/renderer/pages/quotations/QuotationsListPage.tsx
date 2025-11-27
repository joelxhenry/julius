import { Title, Group, Button, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconFileDescription } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useQuotations } from '../../hooks';
import type { Quotation } from '../../../main/database/schema';
import numeral from 'numeral';

export function QuotationsListPage() {
  const navigate = useNavigate();
  const { quotations, loading } = useQuotations();

  const columns: ColumnDef<Quotation>[] = [
    {
      key: 'legacyId',
      title: 'Quotation #',
      sortable: true,
      width: 120,
      render: (value) => `#${value}`
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
      key: 'validUntil',
      title: 'Valid Until',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleDateString() : 'N/A',
    },
    {
      key: 'total',
      title: 'Total',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value || 'DRAFT'} />,
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconFileDescription size={32} />
          <Title order={2}>Quotations</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => navigate('/quotations/new')}
        >
          New Quotation
        </Button>
      </Group>

      <DataTable
        data={quotations}
        columns={columns}
        loading={loading}
        onRowClick={(quotation) => navigate(`/quotations/${quotation.id}`)}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
