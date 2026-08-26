import { useState, useEffect, useMemo } from 'react';
import { Paper, Badge, Text, Group, Select, Button } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue, getLastNDaysRange } from '../common/DateRangeFilter';
import { IpcChannel } from '../../../shared/types/ipc';
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
  createdAt: string;
}

interface ClientPaymentsTabProps {
  clientId: number;
}

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

export function ClientPaymentsTab({ clientId }: ClientPaymentsTabProps) {
  const { openTab } = useTabContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [clientId, page, paymentMethod, startDate, endDate]);

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
        render: (payment) => (
          <Text ta="right" fw={500} c="green">
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
        render: (payment) => payment.paymentDesc2 || '-',
      },
    ],
    [methodNameByCode]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Group gap="md" align="flex-end" wrap="wrap" mb="md">
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
