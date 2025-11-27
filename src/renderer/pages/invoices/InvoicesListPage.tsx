import { Title, Group, Button, Stack } from '@mantine/core';
import { IconPlus, IconFileInvoice } from '@tabler/icons-react';
import { useMemo, useCallback } from 'react';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useInvoices } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Invoice } from '../../../main/database/schema';
import numeral from 'numeral';

export function InvoicesListPage() {
  const { openTab } = useTabManager();
  const { invoices, loading } = useInvoices();

  // Memoize columns to prevent recreation on every render
  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        title: 'Invoice #',
        sortable: true,
        width: 120,
      },
      {
        key: 'clientName',
        title: 'Client',
        sortable: true,
        render: (value) => value || 'Walk-in',
      },
      {
        key: 'createdAt',
        title: 'Date',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : 'N/A'),
      },
      {
        key: 'dueDate',
        title: 'Due Date',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : 'N/A'),
      },
      {
        key: 'total',
        title: 'Total',
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
    ],
    []
  );

  // Memoize row click handler
  const handleRowClick = useCallback(
    (invoice: Invoice, options?: RowClickOptions) => {
      openTab(
        {
          type: 'invoice-editor',
          path: `/invoices/${invoice.id}`,
          title: `Invoice ${invoice.invoiceNumber}`,
          entityId: invoice.id.toString(),
        },
        options?.newTab
      );
    },
    [openTab]
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <IconFileInvoice size={32} />
          <Title order={2}>Invoices</Title>
        </Group>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => openTab({
            type: 'invoice-editor',
            path: '/invoices/new',
            title: 'New Invoice',
            entityId: 'new',
          })}
        >
          New Invoice
        </Button>
      </Group>

      <DataTable
        data={invoices}
        columns={columns}
        loading={loading}
        onRowClick={handleRowClick}
        searchable
        pagination
        rowKey="id"
      />
    </Stack>
  );
}
