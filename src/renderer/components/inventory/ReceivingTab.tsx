import { useState, useEffect, useMemo, useCallback } from 'react';
import { Paper, Text, Badge } from '@mantine/core';
import { DataTable, Column } from '../common/DataTable';
import { IpcChannel } from '../../../shared/types/ipc';

interface InventoryReceiving {
  id: number;
  sku: string;
  supplier: string | null;
  supplierId: number | null;
  receivingDate: string | null;
  quantity: number | null;
  lastCost: string | null;
  lastCostCurrency: string | null;
  priorCost: string | null;
  priorCostCurrency: string | null;
  lastPrice: string | null;
  lastPriceCurrency: string | null;
  reference: string | null;
  createdAt: string;
}

interface ReceivingTabProps {
  sku: string;
}

const formatCurrency = (value: string | null, currency?: string | null) => {
  if (!value) return '-';
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'US' ? 'USD' : 'JMD',
  }).format(num);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function ReceivingTab({ sku }: ReceivingTabProps) {
  const [receiving, setReceiving] = useState<InventoryReceiving[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const loadReceiving = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_RECEIVING_BY_SKU_PAGINATED, {
        sku,
        page,
        pageSize,
      });
      if (result.success && result.data) {
        setReceiving(result.data.data);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load receiving:', error);
    } finally {
      setLoading(false);
    }
  }, [sku, page]);

  useEffect(() => {
    loadReceiving();
  }, [loadReceiving]);

  const columns: Column<InventoryReceiving>[] = useMemo(
    () => [
      {
        key: 'receivingDate',
        header: 'Date',
        width: 120,
        render: (row) => formatDate(row.receivingDate),
      },
      {
        key: 'supplier',
        header: 'Supplier',
        width: 180,
        render: (row) =>
          row.supplier ? (
            <Badge variant="light" color="blue">
              {row.supplier}
            </Badge>
          ) : (
            <Text size="sm" c="dimmed">
              -
            </Text>
          ),
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: 100,
        render: (row) => (
          <Text c="green" fw={500}>
            +{row.quantity || 0}
          </Text>
        ),
      },
      {
        key: 'lastCost',
        header: 'Unit Cost',
        width: 120,
        render: (row) => formatCurrency(row.lastCost, row.lastCostCurrency),
      },
      {
        key: 'priorCost',
        header: 'Prior Cost',
        width: 120,
        render: (row) => formatCurrency(row.priorCost, row.priorCostCurrency),
      },
      {
        key: 'reference',
        header: 'Reference',
        render: (row) => row.reference || '-',
      },
    ],
    []
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <DataTable
        columns={columns}
        data={receiving}
        loading={loading}
        keyField="id"
        emptyMessage="No receiving records found for this item"
        minWidth={700}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
