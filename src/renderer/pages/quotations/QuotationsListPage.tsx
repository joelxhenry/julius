import { Title, Group, Button, Stack } from '@mantine/core';
import { IconPlus, IconFileDescription } from '@tabler/icons-react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useQuotations } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Quotation } from '../../../main/database/schema';
import numeral from 'numeral';

export function QuotationsListPage() {
  const { openTab } = useTabManager();
  const { quotations, loading } = useQuotations();

  const columns: ColumnDef<Quotation>[] = [
    {
      key: 'id',
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
          onClick={() => openTab({
            type: 'quotation-editor',
            path: '/quotations/new',
            title: 'New Quotation',
            entityId: 'new',
          })}
        >
          New Quotation
        </Button>
      </Group>

      <DataTable
        data={quotations}
        columns={columns}
        loading={loading}
        onRowClick={(quotation: Quotation, options?: RowClickOptions) => {
          openTab({
            type: 'quotation-editor',
            path: `/quotations/${quotation.id}`,
            title: `Quotation #${quotation.id}`,
            entityId: quotation.id.toString(),
          }, options?.newTab);
        }}
        searchable
        pagination
        keyboardNav
      />
    </Stack>
  );
}
