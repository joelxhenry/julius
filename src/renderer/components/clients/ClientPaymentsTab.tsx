import { useState, useEffect, useMemo } from 'react';
import { Paper, Badge, Text, Group, Select, Button, Menu } from '@mantine/core';
import {
  IconFilterOff,
  IconDownload,
  IconFileTypeCsv,
  IconFileSpreadsheet,
  IconPrinter,
  IconFileTypePdf,
  IconEye,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue, getLastNDaysRange } from '../common/DateRangeFilter';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn, ExportFormat, ExportRequest } from '../../../shared/types/export';
import type { PrintOutputMode } from '../../../shared/types/print';
import { usePaymentReportPrint } from '../../hooks';
import { useTabContext } from '../../contexts/TabContext';

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
}

interface Payment {
  id: number;
  paymentDate: string;
  amount: string;
  paymentDesc: string | null;
  documentType: string;
  documentNumber: string;
  invoiceId?: number;
  paymentDesc2: string | null;
  transactionReference: string | null;
  createdAt: string;
}

interface ClientPaymentsTabProps {
  clientId: number;
  /** Client display name, used for the exported report's file name. */
  clientName?: string;
  /** Bump to force a reload (e.g. after a client-level bulk payment). */
  refreshToken?: number;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Date', key: 'date', format: 'date' },
  { header: 'Type', key: 'type' },
  { header: 'Document', key: 'document' },
  { header: 'Amount', key: 'amount', format: 'currency' },
  { header: 'Method', key: 'method' },
  { header: 'Reference', key: 'reference' },
  { header: 'Notes', key: 'notes' },
];

const documentTypeColors: Record<string, string> = {
  invoice: 'blue',
  credit_note: 'orange',
  bill: 'purple',
};

const documentTypeLabels: Record<string, string> = {
  invoice: 'Invoice',
  credit_note: 'Credit Note',
  bill: 'Bill',
};

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function ClientPaymentsTab({ clientId, clientName, refreshToken }: ClientPaymentsTabProps) {
  const { openTab } = useTabContext();
  const { printPaymentReport, isPrinting } = usePaymentReportPrint();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getLastNDaysRange(30));
  const pageSize = 30;

  const [startDate, endDate] = dateRange;
  const hasActiveFilters = paymentMethod !== null || startDate !== null || endDate !== null;

  // Load active payment methods for the method filter
  useEffect(() => {
    const loadMethods = async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {});
        if (result.success && result.data) {
          setPaymentMethods(result.data);
        }
      } catch (error) {
        console.error('Failed to load payment methods:', error);
      }
    };
    loadMethods();
  }, []);

  // Reset to first page whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [paymentMethod, startDate, endDate]);

  useEffect(() => {
    loadPayments();
  }, [clientId, page, paymentMethod, startDate, endDate, refreshToken]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, {
        clientId,
        page,
        pageSize,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (result.success && result.data) {
        setPayments(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const paymentMethodOptions = useMemo(
    () => paymentMethods.map((pm) => ({ value: pm.code, label: pm.name })),
    [paymentMethods]
  );

  const methodNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    paymentMethods.forEach((pm) => map.set(pm.code, pm.name));
    return map;
  }, [paymentMethods]);

  // The method code lives in paymentDesc on some rows and paymentDesc2 on
  // others; notes live in paymentDesc unless it held the code.
  const resolveMethod = (payment: Payment) => {
    const code = [payment.paymentDesc, payment.paymentDesc2].find(
      (v) => v && methodNameByCode.has(v)
    );
    return (code ? methodNameByCode.get(code) : payment.paymentDesc) || '';
  };
  const resolveNotes = (payment: Payment) =>
    payment.paymentDesc && !methodNameByCode.has(payment.paymentDesc) ? payment.paymentDesc : '';

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      // Export ALL payments matching the current filters, not just this page.
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, {
        clientId,
        page: 1,
        pageSize: 100000,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const rows: Payment[] = result.success && result.data ? result.data.data : [];
      if (rows.length === 0) {
        notifications.show({
          title: 'Nothing to export',
          message: 'There are no payments for the current filters.',
          color: 'yellow',
        });
        return;
      }

      let fileName = `${clientName || 'Client'} Payments`;
      if (startDate && endDate) fileName += ` ${startDate} to ${endDate}`;
      else if (startDate) fileName += ` from ${startDate}`;
      else if (endDate) fileName += ` to ${endDate}`;

      const request: ExportRequest = {
        fileName,
        format,
        columns: EXPORT_COLUMNS,
        sheetName: 'Payments',
        rows: rows.map((p) => ({
          date: formatDate(p.paymentDate),
          type: documentTypeLabels[p.documentType] || p.documentType,
          document: p.documentNumber,
          amount: parseFloat(p.amount) || 0,
          method: resolveMethod(p),
          reference: p.transactionReference || '',
          notes: resolveNotes(p),
        })),
      };

      const exportResult = await window.electron.invoke(IpcChannel.EXPORT_REPORT, request);
      if (exportResult?.filePath) {
        notifications.show({
          title: 'Export complete',
          message: `Saved ${rows.length} payment${rows.length !== 1 ? 's' : ''} to ${exportResult.filePath}`,
          color: 'green',
        });
      }
    } catch (error) {
      console.error('Failed to export payments:', error);
      notifications.show({
        title: 'Export failed',
        message: 'Could not export the payment report.',
        color: 'red',
      });
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = (outputMode: PrintOutputMode) => {
    printPaymentReport(
      {
        clientId,
        clientName,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      },
      outputMode,
    );
  };

  const columns: Column<Payment>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Date',
        width: 120,
        render: (payment) => formatDate(payment.paymentDate),
      },
      {
        key: 'documentNumber',
        header: 'Document',
        width: 180,
        render: (payment) => (
          <Group gap="xs">
            <Badge variant="light" size="sm" color={documentTypeColors[payment.documentType]}>
              {documentTypeLabels[payment.documentType] || payment.documentType}
            </Badge>
            <Text size="sm">{payment.documentNumber}</Text>
          </Group>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 120,
        // Refunds/voids are negative - show them red, actual receipts green.
        render: (payment) => (
          <Text ta="right" fw={500} c={parseFloat(payment.amount) < 0 ? 'red' : 'green'}>
            {formatCurrency(payment.amount)}
          </Text>
        ),
      },
      {
        key: 'paymentDesc',
        header: 'Method',
        width: 120,
        // The method code lives in paymentDesc on some code paths and in
        // paymentDesc2 on others; resolve whichever matches a known method.
        render: (payment) => {
          const code = [payment.paymentDesc, payment.paymentDesc2].find(
            (v) => v && methodNameByCode.has(v)
          );
          return (code ? methodNameByCode.get(code) : payment.paymentDesc) || '-';
        },
      },
      {
        key: 'reference',
        header: 'Reference',
        render: (payment) => payment.transactionReference || '-',
      },
      {
        key: 'notes',
        header: 'Notes',
        // Notes live in paymentDesc - but on legacy rows that field held the
        // method code, so don't surface a method code as a note.
        render: (payment) => {
          const desc = payment.paymentDesc;
          return desc && !methodNameByCode.has(desc) ? desc : '-';
        },
      },
    ],
    [methodNameByCode]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between" align="flex-end" wrap="wrap" mb="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <Select
            label="Payment Method"
            placeholder="All Methods"
            data={paymentMethodOptions}
            value={paymentMethod}
            onChange={setPaymentMethod}
            clearable
            w={200}
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => {
                setPaymentMethod(null);
                setDateRange([null, null]);
              }}
            >
              Clear filters
            </Button>
          )}
        </Group>

        <Menu shadow="md" width={210}>
          <Menu.Target>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              loading={exporting || isPrinting}
              disabled={loading || payments.length === 0}
            >
              Export / Print
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Export</Menu.Label>
            <Menu.Item
              leftSection={<IconFileTypeCsv size={16} />}
              onClick={() => handleExport('csv')}
            >
              Export as CSV
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={() => handleExport('xlsx')}
            >
              Export as Excel
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>Print Report</Menu.Label>
            <Menu.Item
              leftSection={<IconPrinter size={16} />}
              onClick={() => handlePrint('print')}
            >
              Print
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileTypePdf size={16} />}
              onClick={() => handlePrint('pdf')}
            >
              Save as PDF
            </Menu.Item>
            <Menu.Item
              leftSection={<IconEye size={16} />}
              onClick={() => handlePrint('preview')}
            >
              Preview
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
        keyField="id"
        emptyMessage="No payments found for this client"
        minWidth={700}
        onRowClick={(payment) => {
          openTab(`/payments/${payment.id}`);
        }}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
