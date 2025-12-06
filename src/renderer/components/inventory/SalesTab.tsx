import { useMemo } from 'react';
import { Stack, SimpleGrid, Card, Text, Paper, Badge, Group, NumberFormatter } from '@mantine/core';
import { DataTable, Column } from '../common/DataTable';

interface SaleRecord {
  id: number;
  documentNumber: string;
  documentType: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  documentDate: string;
  clientName?: string;
}

interface SalesSummary {
  totalQuantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  transactionCount: number;
}

interface SalesTabProps {
  sales: SaleRecord[];
  salesSummary: SalesSummary | null;
  loading: boolean;
  page: number;
  totalPages: number;
  unit: string;
  onPageChange: (page: number) => void;
  formatCurrency: (amount: number | string, currency?: string) => string;
}

export function SalesTab({
  sales,
  salesSummary,
  loading,
  page,
  totalPages,
  unit,
  onPageChange,
  formatCurrency,
}: SalesTabProps) {
  const salesColumns: Column<SaleRecord>[] = useMemo(
    () => [
      {
        key: 'documentDate',
        header: 'Date',
        width: 120,
        accessor: 'documentDate',
      },
      {
        key: 'documentNumber',
        header: 'Document',
        width: 180,
        render: (sale) => (
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {sale.documentType}
            </Badge>
            <Text size="sm">{sale.documentNumber}</Text>
          </Group>
        ),
      },
      {
        key: 'clientName',
        header: 'Customer',
        render: (sale) => sale.clientName || '-',
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: 100,
        accessor: 'quantity',
      },
      {
        key: 'unitPrice',
        header: 'Unit Price',
        width: 120,
        render: (sale) => <NumberFormatter value={sale.unitPrice} prefix="$" thousandSeparator decimalScale={2} />,
      },
      {
        key: 'lineTotal',
        header: 'Total',
        width: 120,
        render: (sale) => (
          <Text fw={500}>
            <NumberFormatter value={sale.lineTotal} prefix="$" thousandSeparator decimalScale={2} />
          </Text>
        ),
      },
    ],
    []
  );

  return (
    <Stack gap="md">
      {/* Sales Summary */}
      {salesSummary && (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Sold
            </Text>
            <Text size="xl" fw={700}>
              {salesSummary.totalQuantitySold} {unit}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Revenue
            </Text>
            <Text size="xl" fw={700}>
              {formatCurrency(salesSummary.totalRevenue)}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Avg. Price
            </Text>
            <Text size="xl" fw={700}>
              {formatCurrency(salesSummary.averagePrice)}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Transactions
            </Text>
            <Text size="xl" fw={700}>
              {salesSummary.transactionCount}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {/* Sales List */}
      <Paper p="md" radius="md" withBorder>
        <DataTable
          columns={salesColumns}
          data={sales}
          loading={loading}
          keyField="id"
          emptyMessage="No sales records found"
          minWidth={700}
          page={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </Paper>
    </Stack>
  );
}
