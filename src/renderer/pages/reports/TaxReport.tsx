import { useState, useCallback, useMemo } from 'react';
import { Table, Text, LoadingOverlay, Box, Select, Button, SimpleGrid, Paper, Stack } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { MONTH_NAMES } from '../../../shared/constants/months';
import { ReportShell } from './components/ReportShell';

interface TaxCategoryRow {
  category: string;
  deductibleTotal: number;
  nonDeductibleTotal: number;
  taxPaid: number;
}

interface TaxMonthRow {
  month: number;
  deductibleTotal: number;
  nonDeductibleTotal: number;
  taxPaid: number;
}

interface TaxReportData {
  year: number;
  salesTaxCollected: number;
  expenseTaxPaid: number;
  netTaxPosition: number;
  totalDeductibleExpenses: number;
  totalNonDeductibleExpenses: number;
  byCategory: TaxCategoryRow[];
  byMonth: TaxMonthRow[];
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Category', key: 'category', format: 'text' },
  { header: 'Deductible', key: 'deductibleTotal', format: 'currency' },
  { header: 'Non-Deductible', key: 'nonDeductibleTotal', format: 'currency' },
  { header: 'Tax Paid', key: 'taxPaid', format: 'currency' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function getYearOptions(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => String(current - i));
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap={4}>
        <Text size="sm" c="dimmed">{label}</Text>
        <Text size="xl" fw={700} c={color}>{value}</Text>
      </Stack>
    </Paper>
  );
}

export function TaxReport() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<TaxReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_TAX_REPORT, { year });
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch tax report:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  const exportRows = useMemo(() => {
    if (!data) return undefined;
    const rows = data.byCategory.map((c) => ({
      category: c.category,
      deductibleTotal: c.deductibleTotal,
      nonDeductibleTotal: c.nonDeductibleTotal,
      taxPaid: c.taxPaid,
    }));
    rows.push({
      category: 'TOTALS',
      deductibleTotal: data.totalDeductibleExpenses,
      nonDeductibleTotal: data.totalNonDeductibleExpenses,
      taxPaid: data.expenseTaxPaid,
    });
    return rows as unknown as Record<string, unknown>[];
  }, [data]);

  const yearActions = (
    <>
      <Select
        aria-label="Year"
        data={getYearOptions()}
        value={String(year)}
        onChange={(value) => value && setYear(Number(value))}
        allowDeselect={false}
        w={110}
        size="sm"
      />
      <Button variant="filled" size="sm" onClick={fetchReport} loading={loading}>
        Generate
      </Button>
    </>
  );

  return (
    <ReportShell
      title="Tax Summary"
      actions={yearActions}
      exportColumns={EXPORT_COLUMNS}
      exportRows={exportRows}
      exportFileName={data ? `Tax Summary ${data.year}` : 'Tax Summary'}
      loading={loading}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatTile label="Sales Tax Collected" value={formatCurrency(data.salesTaxCollected)} color="teal" />
              <StatTile label="Expense Tax Paid" value={formatCurrency(data.expenseTaxPaid)} color="orange" />
              <StatTile
                label="Net Tax Position"
                value={formatCurrency(data.netTaxPosition)}
                color={data.netTaxPosition >= 0 ? 'green' : 'red'}
              />
            </SimpleGrid>

            <Text fw={600}>By Category</Text>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th ta="right">Deductible</Table.Th>
                  <Table.Th ta="right">Non-Deductible</Table.Th>
                  <Table.Th ta="right">Tax Paid</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.byCategory.map((c) => (
                  <Table.Tr key={c.category}>
                    <Table.Td fw={500}>{c.category}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(c.deductibleTotal)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(c.nonDeductibleTotal)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(c.taxPaid)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>Totals</Table.Th>
                  <Table.Th ta="right">{formatCurrency(data.totalDeductibleExpenses)}</Table.Th>
                  <Table.Th ta="right">{formatCurrency(data.totalNonDeductibleExpenses)}</Table.Th>
                  <Table.Th ta="right">{formatCurrency(data.expenseTaxPaid)}</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>

            <Text fw={600}>By Month</Text>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th ta="right">Deductible</Table.Th>
                  <Table.Th ta="right">Non-Deductible</Table.Th>
                  <Table.Th ta="right">Tax Paid</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.byMonth.map((m) => (
                  <Table.Tr key={m.month}>
                    <Table.Td fw={500}>{MONTH_NAMES[m.month - 1] ?? m.month}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(m.deductibleTotal)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(m.nonDeductibleTotal)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(m.taxPaid)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}

        {!data && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            Select a year and click Generate to view the tax summary.
          </Text>
        )}
      </Box>
    </ReportShell>
  );
}
