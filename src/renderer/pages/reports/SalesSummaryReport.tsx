import { useState, useCallback } from 'react';
import { SimpleGrid, Table, Text, LoadingOverlay, Box } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { MetricCard } from './components/MetricCard';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Payment Method', key: 'method' },
  { header: 'Count', key: 'count', format: 'number' },
  { header: 'Total', key: 'total', format: 'currency' },
];

interface SalesSummaryData {
  totalInvoices: number;
  totalRevenue: number;
  totalTax: number;
  totalPaymentsReceived: number;
  totalOutstanding: number;
  byPaymentMethod: Array<{ method: string; total: number; count: number }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

export function SalesSummaryReport() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<Date | null>(defaults.start);
  const [endDate, setEndDate] = useState<Date | null>(defaults.end);
  const [data, setData] = useState<SalesSummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = new Date(startDate).toISOString().split('T')[0];
      if (endDate) params.endDate = new Date(endDate).toISOString().split('T')[0];

      const result = await window.electron.invoke(IpcChannel.GET_SALES_REPORT, params);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch sales report:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <ReportShell
      title="Sales Summary"
      showDateRange
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      loading={loading}
      onRefresh={fetchReport}
      exportColumns={EXPORT_COLUMNS}
      exportRows={data?.byPaymentMethod}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <>
            <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md" mb="lg">
              <MetricCard label="Total Invoices" value={data.totalInvoices} />
              <MetricCard label="Revenue" value={formatCurrency(data.totalRevenue)} color="blue" />
              <MetricCard label="Tax Collected" value={formatCurrency(data.totalTax)} />
              <MetricCard label="Payments Received" value={formatCurrency(data.totalPaymentsReceived)} color="green" />
              <MetricCard
                label="Outstanding"
                value={formatCurrency(data.totalOutstanding)}
                color={data.totalOutstanding > 0 ? 'red' : 'green'}
              />
            </SimpleGrid>

            {data.byPaymentMethod.length > 0 && (
              <>
                <Text fw={600} mb="xs">Payment Method Breakdown</Text>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Payment Method</Table.Th>
                      <Table.Th ta="right">Count</Table.Th>
                      <Table.Th ta="right">Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.byPaymentMethod.map((row) => (
                      <Table.Tr key={row.method}>
                        <Table.Td>{row.method}</Table.Td>
                        <Table.Td ta="right">{row.count}</Table.Td>
                        <Table.Td ta="right">{formatCurrency(row.total)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </>
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
