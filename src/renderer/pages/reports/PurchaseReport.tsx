import { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Text,
  LoadingOverlay,
  Box,
  Select,
  Button,
  Menu,
} from '@mantine/core';
import { IconPrinter, IconEye, IconFileTypePdf } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { MONTH_NAMES } from '../../../shared/constants/months';
import { ReportShell } from './components/ReportShell';
import { usePurchaseReportPrint } from '../../hooks/usePurchaseReportPrint';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Month', key: 'monthName', format: 'text' },
  { header: 'Total', key: 'total', format: 'currency' },
  { header: 'Paid Out', key: 'paidOut', format: 'currency' },
  { header: 'Payable', key: 'payable', format: 'currency' },
];

interface MonthRow {
  month: number;
  total: number;
  paidOut: number;
  payable: number;
}

interface PurchaseReportData {
  year: number;
  months: MonthRow[];
  totals: {
    total: number;
    paidOut: number;
    payable: number;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function getYearOptions(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 10 }, (_, i) => String(current - i));
}

export function PurchaseReport() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<PurchaseReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const { printPurchaseReport, isPrinting } = usePurchaseReportPrint();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PURCHASE_REPORT, { year });
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch purchase report:', error);
    } finally {
      setLoading(false);
    }
  }, [year]);

  // Rows for CSV/Excel export: 12 months plus a trailing totals row.
  const exportRows = useMemo(() => {
    if (!data) return undefined;
    const rows = data.months.map((m) => ({
      monthName: MONTH_NAMES[m.month - 1] ?? String(m.month),
      total: m.total,
      paidOut: m.paidOut,
      payable: m.payable,
    }));
    rows.push({ monthName: 'TOTALS', ...data.totals });
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
            onClick={() => printPurchaseReport({ year }, 'preview')}
          >
            Preview
          </Menu.Item>
          <Menu.Item
            leftSection={<IconFileTypePdf size={16} />}
            onClick={() => printPurchaseReport({ year }, 'pdf')}
          >
            Save as PDF
          </Menu.Item>
          <Menu.Item
            leftSection={<IconPrinter size={16} />}
            onClick={() => printPurchaseReport({ year }, 'print')}
          >
            Print
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );

  return (
    <ReportShell
      title="Purchase Report"
      actions={yearActions}
      exportColumns={EXPORT_COLUMNS}
      exportRows={exportRows}
      exportFileName={data ? `Purchase Report ${data.year}` : 'Purchase Report'}
      loading={loading}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Month</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th ta="right">Paid Out</Table.Th>
                <Table.Th ta="right">Payable</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.months.map((m) => (
                <Table.Tr key={m.month}>
                  <Table.Td fw={500}>{MONTH_NAMES[m.month - 1] ?? m.month}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(m.total)}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(m.paidOut)}</Table.Td>
                  <Table.Td ta="right" c={m.payable > 0 ? 'orange' : undefined}>
                    {formatCurrency(m.payable)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th>Totals</Table.Th>
                <Table.Th ta="right">{formatCurrency(data.totals.total)}</Table.Th>
                <Table.Th ta="right">{formatCurrency(data.totals.paidOut)}</Table.Th>
                <Table.Th ta="right">{formatCurrency(data.totals.payable)}</Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>
        )}

        {!data && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            Select a year and click Generate to view the report.
          </Text>
        )}
      </Box>
    </ReportShell>
  );
}
