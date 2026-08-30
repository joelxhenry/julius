import { useState, useCallback } from 'react';
import {
  Table,
  Text,
  LoadingOverlay,
  Box,
  Paper,
  Group,
  Stack,
  SimpleGrid,
  Divider,
  Menu,
  Button,
  ScrollArea,
} from '@mantine/core';
import { IconPrinter, IconEye, IconFileTypePdf } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { useSalesReportPrint } from '../../hooks/useSalesReportPrint';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Invoice', key: 'invoiceNumber', format: 'text' },
  { header: 'Payment Type', key: 'paymentType', format: 'text' },
  { header: 'Customer', key: 'clientName', format: 'text' },
  { header: 'Date', key: 'date', format: 'date' },
  { header: 'Amount', key: 'amount', format: 'currency' },
];

interface PaymentType {
  method: string;
  count: number;
  total: number;
}

interface DetailItem {
  invoiceNumber: string | null;
  paymentType: string;
  clientName: string | null;
  date: string | null;
  amount: number;
}

interface SalesReportData {
  startDate: string | null;
  endDate: string | null;
  netSales: number;
  taxCollected: number;
  grossSales: number;
  numCustomers: number;
  averageSale: number;
  numPayments: number;
  valuePayments: number;
  numRefunds: number;
  valueRefunds: number;
  numDiscounts: number;
  valueDiscounts: number;
  paymentTypes: PaymentType[];
  detail: DetailItem[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatCount = (value: number) => new Intl.NumberFormat('en-US').format(value);

function getDefaultDateRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end: now };
}

function StatRow({
  label,
  count,
  value,
  danger,
}: {
  label: string;
  count: number;
  value: string;
  danger?: boolean;
}) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Group gap="lg" wrap="nowrap">
        <Text size="sm" fw={700} c={danger ? 'red' : undefined} w={60} ta="right">
          {formatCount(count)}
        </Text>
        <Text size="sm" fw={700} c={danger ? 'red' : undefined} w={140} ta="right">
          {value}
        </Text>
      </Group>
    </Group>
  );
}

export function SalesSummaryReport() {
  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState<Date | null>(defaults.start);
  const [endDate, setEndDate] = useState<Date | null>(defaults.end);
  const [data, setData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const { printSalesReport, isPrinting } = useSalesReportPrint();

  const dateParams = useCallback(() => {
    const params: { startDate?: string; endDate?: string } = {};
    if (startDate) params.startDate = new Date(startDate).toISOString().split('T')[0];
    if (endDate) params.endDate = new Date(endDate).toISOString().split('T')[0];
    return params;
  }, [startDate, endDate]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_SALES_REPORT, dateParams());
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch sales report:', error);
    } finally {
      setLoading(false);
    }
  }, [dateParams]);

  const paymentTypesTotalCount = data?.paymentTypes.reduce((s, t) => s + t.count, 0) ?? 0;
  const paymentTypesTotal = data?.paymentTypes.reduce((s, t) => s + t.total, 0) ?? 0;

  const printActions = (
    <Menu shadow="md" width={200} disabled={!data || loading}>
      <Menu.Target>
        <Button
          variant="light"
          leftSection={<IconPrinter size={16} />}
          disabled={!data || loading}
          loading={isPrinting}
        >
          Print
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEye size={16} />}
          onClick={() => printSalesReport(dateParams(), 'preview')}
        >
          Preview
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileTypePdf size={16} />}
          onClick={() => printSalesReport(dateParams(), 'pdf')}
        >
          Save as PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconPrinter size={16} />}
          onClick={() => printSalesReport(dateParams(), 'print')}
        >
          Print
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <ReportShell
      title="Sales Report"
      showDateRange
      rangePicker
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={setStartDate}
      onEndDateChange={setEndDate}
      loading={loading}
      onRefresh={fetchReport}
      actions={printActions}
      exportColumns={EXPORT_COLUMNS}
      exportRows={data?.detail as unknown as Record<string, unknown>[] | undefined}
      exportFileName="Sales Report"
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              {/* Summary block */}
              <Paper withBorder p="md" radius="md">
                <Stack gap={6}>
                  <Group justify="space-between">
                    <Text fw={600}>Net Sales</Text>
                    <Text fw={700}>{formatCurrency(data.netSales)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={600}>Tax Collected</Text>
                    <Text fw={700}>{formatCurrency(data.taxCollected)}</Text>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text fw={700} size="lg">
                      Gross Sales
                    </Text>
                    <Text fw={700} size="lg" c="blue">
                      {formatCurrency(data.grossSales)}
                    </Text>
                  </Group>
                </Stack>
              </Paper>

              {/* Stats */}
              <Paper withBorder p="md" radius="md">
                <Stack gap={8}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text size="sm" c="dimmed">
                      No. of Customers
                    </Text>
                    <Group gap="lg" wrap="nowrap">
                      <Text size="sm" fw={700} w={60} ta="right">
                        {formatCount(data.numCustomers)}
                      </Text>
                      <Text size="sm" c="dimmed" w={140} ta="right">
                        Avg {formatCurrency(data.averageSale)}
                      </Text>
                    </Group>
                  </Group>
                  <StatRow
                    label="No. of Payments"
                    count={data.numPayments}
                    value={formatCurrency(data.valuePayments)}
                  />
                  <StatRow
                    label="No. of Refunds"
                    count={data.numRefunds}
                    value={formatCurrency(data.valueRefunds)}
                    danger
                  />
                  <StatRow
                    label="No. of Discounts"
                    count={data.numDiscounts}
                    value={formatCurrency(data.valueDiscounts)}
                  />
                </Stack>
              </Paper>
            </SimpleGrid>

            {/* Payment Report */}
            <Box>
              <Text fw={600} mb="xs">
                Payment Report
              </Text>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Payment Type</Table.Th>
                    <Table.Th ta="right">No. of Payments</Table.Th>
                    <Table.Th ta="right">Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.paymentTypes.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={3}>
                        <Text c="dimmed" ta="center" py="sm">
                          No payments in this period
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    data.paymentTypes.map((row) => (
                      <Table.Tr key={row.method}>
                        <Table.Td>{row.method}</Table.Td>
                        <Table.Td ta="right">{formatCount(row.count)}</Table.Td>
                        <Table.Td ta="right">{formatCurrency(row.total)}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
                {data.paymentTypes.length > 0 && (
                  <Table.Tfoot>
                    <Table.Tr>
                      <Table.Th ta="right">Total</Table.Th>
                      <Table.Th ta="right">{formatCount(paymentTypesTotalCount)}</Table.Th>
                      <Table.Th ta="right">{formatCurrency(paymentTypesTotal)}</Table.Th>
                    </Table.Tr>
                  </Table.Tfoot>
                )}
              </Table>
            </Box>

            {/* Payment Detail */}
            <Box>
              <Text fw={600} mb="xs">
                Payment Detail ({formatCount(data.detail.length)})
              </Text>
              <ScrollArea.Autosize mah={420}>
                <Table striped highlightOnHover withTableBorder stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th>Payment Type</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Date</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.detail.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center" py="sm">
                            No payments in this period
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      data.detail.map((row, i) => (
                        <Table.Tr key={`${row.invoiceNumber ?? 'x'}-${i}`}>
                          <Table.Td>{row.invoiceNumber ?? '-'}</Table.Td>
                          <Table.Td>{row.paymentType}</Table.Td>
                          <Table.Td>{row.clientName ?? '-'}</Table.Td>
                          <Table.Td>{row.date ?? '-'}</Table.Td>
                          <Table.Td ta="right" c={row.amount < 0 ? 'red' : undefined}>
                            {formatCurrency(row.amount)}
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
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
