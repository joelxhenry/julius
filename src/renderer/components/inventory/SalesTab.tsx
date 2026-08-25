import { useMemo } from 'react';
import { Stack, SimpleGrid, Card, Text, Paper, Badge, Group, NumberFormatter, Anchor, Tooltip, Button, Select } from '@mantine/core';
import { IconFilterOff, IconExternalLink } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';

interface SaleRecord {
  id: number;
  invoiceId?: number;
  documentNumber: string;
  documentType: string;
  sku?: string;
  isVariant?: boolean;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  documentDate: string;
  clientName?: string;
}

interface SalesSummary {
  totalUnitsSold: number;
  totalRevenue: number;
  averagePrice: number;
  transactionCount: number;
}

interface VariantFilterOption {
  value: string;
  label: string;
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
  variant: string | null;
  onVariantChange: (variant: string | null) => void;
  variantOptions: VariantFilterOption[];
  dateRange: DateRangeValue;
  onDateRangeChange: (range: DateRangeValue) => void;
  onOpenDocument: (sale: SaleRecord) => void;
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
  variant,
  onVariantChange,
  variantOptions,
  dateRange,
  onDateRangeChange,
  onOpenDocument,
}: SalesTabProps) {
  // Only the base item + variants entries means there are no real variants to filter by.
  const hasVariants = variantOptions.length > 2;

  const hasActiveFilters =
    (variant !== null && variant !== 'all') || dateRange[0] !== null || dateRange[1] !== null;

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
        width: 200,
        render: (sale) => (
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {sale.documentType}
            </Badge>
            <Tooltip label="Open in new tab" withArrow position="top">
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => onOpenDocument(sale)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {sale.documentNumber}
                <IconExternalLink size={14} />
              </Anchor>
            </Tooltip>
          </Group>
        ),
      },
      {
        key: 'clientName',
        header: 'Customer',
        render: (sale) => sale.clientName || '-',
      },
      {
        key: 'sku',
        header: 'Variant',
        width: 140,
        render: (sale) =>
          sale.isVariant && sale.sku ? (
            <Text size="sm" fw={500}>
              {sale.sku}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          ),
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
    [onOpenDocument]
  );

  return (
    <Stack gap="xl">
      {/* Sales Summary — reflects the active date-range filter */}
      {salesSummary && (
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="xl">
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Total Sold
            </Text>
            <Text size="xl" fw={700}>
              {salesSummary.totalUnitsSold} {unit}
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
      <Paper p="xl" radius="md" withBorder>
        <Stack gap="xl">
          <Group gap="lg" align="flex-end" wrap="wrap">
            {hasVariants && (
              <Select
                label="Variant"
                data={variantOptions}
                value={variant ?? 'all'}
                onChange={onVariantChange}
                allowDeselect={false}
                w={220}
              />
            )}
            <DateRangeFilter value={dateRange} onChange={onDateRangeChange} />
            {hasActiveFilters && (
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconFilterOff size={16} />}
                onClick={() => {
                  onVariantChange('all');
                  onDateRangeChange([null, null]);
                }}
              >
                Clear filters
              </Button>
            )}
          </Group>

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
        </Stack>
      </Paper>
    </Stack>
  );
}
