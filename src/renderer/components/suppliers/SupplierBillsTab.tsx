import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Badge, Text, ActionIcon, Stack, Group, Select, Button } from '@mantine/core';
import { IconEye, IconFilterOff } from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';
import { IpcChannel } from '../../../shared/types/ipc';

interface Bill {
  id: number;
  billNo: string;
  billDate: string;
  total: string;
  totalPaid: string;
  status: string;
  createdAt: string;
}

interface SupplierBillsTabProps {
  supplierId: number;
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  partially_paid: 'orange',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
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

export function SupplierBillsTab({ supplierId }: SupplierBillsTabProps) {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);

  useEffect(() => {
    loadBills();
  }, [supplierId]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_BILLS_BY_SUPPLIER, {
        supplierId,
      });
      if (result.success && result.data) {
        setBills(result.data);
      }
    } catch (error) {
      console.error('Failed to load bills:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build status options from the statuses actually present on this supplier's
  // bills so the filter never offers a value that would hide every row.
  const statusOptions = useMemo(() => {
    const present = Array.from(new Set(bills.map((b) => b.status).filter(Boolean)));
    present.sort();
    return [
      { value: 'all', label: 'All Statuses' },
      ...present.map((value) => ({ value, label: statusLabels[value] || value })),
    ];
  }, [bills]);

  const [startDate, endDate] = dateRange;
  const hasActiveFilters = status !== 'all' || startDate !== null || endDate !== null;

  const filteredBills = useMemo(() => {
    return bills.filter((bill) => {
      if (status !== 'all' && bill.status !== status) return false;
      if (startDate || endDate) {
        if (!bill.billDate) return false;
        const day = bill.billDate.slice(0, 10);
        if (startDate && day < startDate) return false;
        if (endDate && day > endDate) return false;
      }
      return true;
    });
  }, [bills, status, startDate, endDate]);

  const clearFilters = () => {
    setStatus('all');
    setDateRange([null, null]);
  };

  const columns: Column<Bill>[] = useMemo(
    () => [
      {
        key: 'billNo',
        header: 'Bill #',
        width: 150,
        render: (bill) => <Text fw={500}>{bill.billNo}</Text>,
      },
      {
        key: 'billDate',
        header: 'Date',
        width: 120,
        render: (bill) => formatDate(bill.billDate),
      },
      {
        key: 'total',
        header: 'Total',
        width: 120,
        render: (bill) => <Text ta="right">{formatCurrency(bill.total)}</Text>,
      },
      {
        key: 'totalPaid',
        header: 'Paid',
        width: 120,
        render: (bill) => (
          <Text ta="right" c="green">
            {formatCurrency(bill.totalPaid)}
          </Text>
        ),
      },
      {
        key: 'balance',
        header: 'Balance',
        width: 120,
        render: (bill) => {
          const balance = parseFloat(bill.total) - parseFloat(bill.totalPaid);
          return (
            <Text ta="right" c={balance > 0 ? 'red' : 'green'}>
              {formatCurrency(balance.toFixed(2))}
            </Text>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (bill) => (
          <Badge color={statusColors[bill.status] || 'gray'} variant="light">
            {statusLabels[bill.status] || bill.status}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (bill) => (
          <ActionIcon variant="subtle" onClick={() => navigate(`/bills/${bill.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        ),
      },
    ],
    [navigate]
  );

  return (
    <Stack gap="md">
      <Paper p="md" radius="md" withBorder>
        <Group gap="md" align="flex-end" wrap="wrap">
          <Select
            label="Status"
            data={statusOptions}
            value={status}
            onChange={(value) => setStatus(value || 'all')}
            allowDeselect={false}
            w={180}
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <DataTable
          columns={columns}
          data={filteredBills}
          loading={loading}
          keyField="id"
          emptyMessage="No bills found for this supplier"
          minWidth={700}
          onRowClick={(bill) => navigate(`/bills/${bill.id}`)}
          stickyActionsColumn
        />
      </Paper>
    </Stack>
  );
}
