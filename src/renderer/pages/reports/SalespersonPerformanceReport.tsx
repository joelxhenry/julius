import { useState, useCallback, useMemo } from 'react';
import { Table, Text, LoadingOverlay, Box } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Salesperson', key: 'name' },
  { header: '# Invoices', key: 'invoiceCount', format: 'number' },
  { header: 'Invoice Total', key: 'invoiceTotal', format: 'currency' },
  { header: '# Quotations', key: 'quoteCount', format: 'number' },
  { header: 'Quote Total', key: 'quoteTotal', format: 'currency' },
  { header: '# Credit Notes', key: 'creditNoteCount', format: 'number' },
  { header: 'CN Total', key: 'creditNoteTotal', format: 'currency' },
  { header: 'Net Sales', key: 'netSales', format: 'currency' },
];

interface SalespersonRow {
  employeeId: number;
  name: string;
  invoiceCount: number;
  invoiceTotal: number;
  quoteCount: number;
  quoteTotal: number;
  creditNoteCount: number;
  creditNoteTotal: number;
  netSales: number;
}

interface SalespersonPerformanceData {
  rows: SalespersonRow[];
  totals: Omit<SalespersonRow, 'employeeId' | 'name'>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

export function SalespersonPerformanceReport() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<Date | null>(defaults.start);
  const [endDate, setEndDate] = useState<Date | null>(defaults.end);
  const [data, setData] = useState<SalespersonPerformanceData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = new Date(startDate).toISOString().split('T')[0];
      if (endDate) params.endDate = new Date(endDate).toISOString().split('T')[0];

      const result = await window.electron.invoke(IpcChannel.GET_SALESPERSON_PERFORMANCE_REPORT, params);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch salesperson performance:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const exportRows = useMemo(() => {
    if (!data) return undefined;
    return [...data.rows, { name: 'TOTAL', ...data.totals }] as Record<string, unknown>[];
  }, [data]);

  return (
    <ReportShell
      title="Salesperson Performance"
      showDateRange
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      loading={loading}
      onRefresh={fetchReport}
      exportColumns={EXPORT_COLUMNS}
      exportRows={exportRows}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Salesperson</Table.Th>
                <Table.Th ta="right"># Invoices</Table.Th>
                <Table.Th ta="right">Invoice Total</Table.Th>
                <Table.Th ta="right"># Quotations</Table.Th>
                <Table.Th ta="right">Quote Total</Table.Th>
                <Table.Th ta="right"># Credit Notes</Table.Th>
                <Table.Th ta="right">CN Total</Table.Th>
                <Table.Th ta="right">Net Sales</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.rows.map((row) => (
                <Table.Tr key={row.employeeId}>
                  <Table.Td fw={500}>{row.name}</Table.Td>
                  <Table.Td ta="right">{row.invoiceCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.invoiceTotal)}</Table.Td>
                  <Table.Td ta="right">{row.quoteCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.quoteTotal)}</Table.Td>
                  <Table.Td ta="right">{row.creditNoteCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.creditNoteTotal)}</Table.Td>
                  <Table.Td ta="right" fw={700} c={row.netSales >= 0 ? 'green' : 'red'}>
                    {formatCurrency(row.netSales)}
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.rows.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8} ta="center" c="dimmed" py="lg">
                    No salespeople found.
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            {data.rows.length > 0 && (
              <Table.Tfoot>
                <Table.Tr style={{ fontWeight: 700 }}>
                  <Table.Td>TOTAL</Table.Td>
                  <Table.Td ta="right">{data.totals.invoiceCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(data.totals.invoiceTotal)}</Table.Td>
                  <Table.Td ta="right">{data.totals.quoteCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(data.totals.quoteTotal)}</Table.Td>
                  <Table.Td ta="right">{data.totals.creditNoteCount}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(data.totals.creditNoteTotal)}</Table.Td>
                  <Table.Td ta="right" c={data.totals.netSales >= 0 ? 'green' : 'red'}>
                    {formatCurrency(data.totals.netSales)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        )}

        {!data && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            Select a date range and click Generate to view the report.
          </Text>
        )}
      </Box>
    </ReportShell>
  );
}
