import { useState, useCallback } from 'react';
import { Table, Text, LoadingOverlay, Box, Paper, Stack, SimpleGrid, Badge, ScrollArea } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { MetricCard } from './components/MetricCard';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Date', key: 'date', format: 'date' },
  { header: 'Direction', key: 'direction', format: 'text' },
  { header: 'Payment Type', key: 'paymentType', format: 'text' },
  { header: 'Reference #', key: 'reference', format: 'text' },
  { header: 'Client', key: 'clientName', format: 'text' },
  { header: 'Transaction Ref', key: 'transactionReference', format: 'text' },
  { header: 'Notes', key: 'notes', format: 'text' },
  { header: 'Processed By', key: 'processedBy', format: 'text' },
  { header: 'Amount', key: 'amount', format: 'currency' },
];

interface PaymentTypeBreakdown {
  method: string;
  count: number;
  total: number;
}

interface PaymentDetailItem {
  paymentId: number;
  date: string | null;
  direction: 'in' | 'out';
  documentType: 'INVOICE' | 'CREDIT';
  reference: string | null;
  clientName: string | null;
  paymentType: string;
  transactionReference: string | null;
  notes: string | null;
  processedBy: string | null;
  amount: number;
}

interface PaymentDetailData {
  startDate: string | null;
  endDate: string | null;
  countIn: number;
  totalIn: number;
  countOut: number;
  totalOut: number;
  netTotal: number;
  inByType: PaymentTypeBreakdown[];
  outByType: PaymentTypeBreakdown[];
  detail: PaymentDetailItem[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

function TypeBreakdownTable({ title, rows, color }: { title: string; rows: PaymentTypeBreakdown[]; color: string }) {
  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.total, 0);

  return (
    <Box>
      <Text fw={600} mb="xs">
        {title}
      </Text>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Payment Type</Table.Th>
            <Table.Th ta="right">Count</Table.Th>
            <Table.Th ta="right">Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length === 0 ? (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text c="dimmed" ta="center" py="sm">
                  None in this period
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            rows.map((row) => (
              <Table.Tr key={row.method}>
                <Table.Td>{row.method}</Table.Td>
                <Table.Td ta="right">{formatCount(row.count)}</Table.Td>
                <Table.Td ta="right" c={color}>
                  {formatCurrency(row.total)}
                </Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
        {rows.length > 0 && (
          <Table.Tfoot>
            <Table.Tr>
              <Table.Th ta="right">Total</Table.Th>
              <Table.Th ta="right">{formatCount(totalCount)}</Table.Th>
              <Table.Th ta="right" c={color}>
                {formatCurrency(totalValue)}
              </Table.Th>
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </Box>
  );
}

export function PaymentDetailReport() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<Date | null>(defaults.start);
  const [endDate, setEndDate] = useState<Date | null>(defaults.end);
  const [data, setData] = useState<PaymentDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: { startDate?: string; endDate?: string } = {};
      if (startDate) params.startDate = new Date(startDate).toISOString().split('T')[0];
      if (endDate) params.endDate = new Date(endDate).toISOString().split('T')[0];

      const result = await window.electron.invoke(IpcChannel.GET_PAYMENT_DETAIL_REPORT, params);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch payment detail report:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  return (
    <ReportShell
      title="Payment Detail Report"
      showDateRange
      rangePicker
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      loading={loading}
      onRefresh={fetchReport}
      exportColumns={EXPORT_COLUMNS}
      exportRows={data?.detail as unknown as Record<string, unknown>[] | undefined}
      exportFileName="Payment Detail Report"
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <MetricCard
                label={`Payments In (${formatCount(data.countIn)})`}
                value={formatCurrency(data.totalIn)}
                color="green"
              />
              <MetricCard
                label={`Returns / Refunds Out (${formatCount(data.countOut)})`}
                value={formatCurrency(data.totalOut)}
                color="red"
              />
              <MetricCard
                label="Net Cash Movement"
                value={formatCurrency(data.netTotal)}
                color={data.netTotal < 0 ? 'red' : 'blue'}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <TypeBreakdownTable title="Payments In by Type" rows={data.inByType} color="green" />
              <TypeBreakdownTable title="Returns / Refunds Out by Type" rows={data.outByType} color="red" />
            </SimpleGrid>

            <Box>
              <Text fw={600} mb="xs">
                Payment Detail ({formatCount(data.detail.length)})
              </Text>
              {data.detail.length === 0 ? (
                <Paper withBorder p="xl" radius="md">
                  <Text c="dimmed" ta="center">
                    No payments in this period
                  </Text>
                </Paper>
              ) : (
                <ScrollArea.Autosize mah={560}>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Date</Table.Th>
                        <Table.Th></Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Reference #</Table.Th>
                        <Table.Th>Client</Table.Th>
                        <Table.Th>Processed By</Table.Th>
                        <Table.Th>Notes</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.detail.map((row) => (
                        <Table.Tr key={row.paymentId}>
                          <Table.Td>{row.date ?? '-'}</Table.Td>
                          <Table.Td>
                            <Badge color={row.direction === 'in' ? 'green' : 'red'} variant="light" size="sm">
                              {row.direction === 'in' ? 'In' : 'Out'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{row.paymentType}</Table.Td>
                          <Table.Td>{row.reference ?? '-'}</Table.Td>
                          <Table.Td>{row.clientName ?? '-'}</Table.Td>
                          <Table.Td>{row.processedBy ?? '-'}</Table.Td>
                          <Table.Td>
                            {row.transactionReference || row.notes ? (
                              <Stack gap={0}>
                                {row.transactionReference && <Text size="sm">{row.transactionReference}</Text>}
                                {row.notes && (
                                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                                    {row.notes}
                                  </Text>
                                )}
                              </Stack>
                            ) : (
                              <Text span c="dimmed">
                                -
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td ta="right" c={row.direction === 'out' ? 'red' : undefined} fw={500}>
                            {formatCurrency(row.amount)}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              )}
            </Box>
          </Stack>
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
