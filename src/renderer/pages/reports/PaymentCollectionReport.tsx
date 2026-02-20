import { useState, useCallback } from 'react';
import { SimpleGrid, Table, Text, LoadingOverlay, Box } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { MetricCard } from './components/MetricCard';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Date', key: 'paymentDate', format: 'date' },
  { header: 'Invoice #', key: 'invoiceNumber' },
  { header: 'Client', key: 'clientName' },
  { header: 'Method', key: 'paymentMethod' },
  { header: 'Amount', key: 'amount', format: 'currency' },
  { header: 'Processed By', key: 'processedBy' },
];

interface PaymentCollectionItem {
  paymentId: number;
  paymentDate: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
  paymentMethod: string | null;
  amount: number;
  processedBy: string | null;
}

interface PaymentMethodSummary {
  method: string;
  total: number;
  count: number;
}

interface PaymentCollectionData {
  payments: PaymentCollectionItem[];
  totalCollected: number;
  byMethod: PaymentMethodSummary[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

export function PaymentCollectionReport() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<Date | null>(defaults.start);
  const [endDate, setEndDate] = useState<Date | null>(defaults.end);
  const [data, setData] = useState<PaymentCollectionData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (startDate) params.startDate = new Date(startDate).toISOString().split('T')[0];
      if (endDate) params.endDate = new Date(endDate).toISOString().split('T')[0];

      const result = await window.electron.invoke(IpcChannel.GET_PAYMENT_COLLECTION_REPORT, params);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch payment collection:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <ReportShell
      title="Payment Collection"
      showDateRange
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      loading={loading}
      onRefresh={fetchReport}
      exportColumns={EXPORT_COLUMNS}
      exportRows={data?.payments as Record<string, unknown>[] | undefined}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <>
            <SimpleGrid cols={{ base: 2, sm: Math.min(data.byMethod.length + 1, 5) }} spacing="md" mb="lg">
              <MetricCard label="Total Collected" value={formatCurrency(data.totalCollected)} color="green" />
              {data.byMethod.map((m) => (
                <MetricCard
                  key={m.method}
                  label={`${m.method} (${m.count})`}
                  value={formatCurrency(m.total)}
                />
              ))}
            </SimpleGrid>

            <Text fw={600} mb="xs">Payments ({data.payments.length})</Text>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Invoice #</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th ta="right">Amount</Table.Th>
                  <Table.Th>Processed By</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.payments.map((p) => (
                  <Table.Tr key={p.paymentId}>
                    <Table.Td>{p.paymentDate || '—'}</Table.Td>
                    <Table.Td>{p.invoiceNumber || '—'}</Table.Td>
                    <Table.Td>{p.clientName || '—'}</Table.Td>
                    <Table.Td>{p.paymentMethod || '—'}</Table.Td>
                    <Table.Td ta="right" fw={500}>{formatCurrency(p.amount)}</Table.Td>
                    <Table.Td>{p.processedBy || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {data.payments.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={6} ta="center" c="dimmed" py="lg">
                      No payments found for the selected period.
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
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
