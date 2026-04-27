import { useState, useEffect, useMemo, useCallback } from 'react';
import { Paper, Text } from '@mantine/core';
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
  reference: string | null;
  createdAt: string;
}

interface SupplierReceivingTabProps {
  supplierId: number;
}

const formatCurrency = (value: string | null, currency?: string | null) => {
  if (!value) return '-';
  const num = parseFloat(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'US' ? 'USD' : 'JMD',
  }).format(num);
};

export function SupplierReceivingTab({ supplierId }: SupplierReceivingTabProps) {
  const [receiving, setReceiving] = useState<InventoryReceiving[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  const loadReceiving = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_RECEIVING_BY_SUPPLIER, {
        supplierId,
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
  }, [supplierId, page]);

  useEffect(() => {
    loadReceiving();
  }, [loadReceiving]);

  const columns: Column<InventoryReceiving>[] = useMemo(
    () => [
      {
        key: 'receivingDate',
        header: 'Date',
        width: 120,
        render: (row) => row.receivingDate || '-',
      },
      {
        key: 'sku',
        header: 'Part Number',
        width: 150,
        accessor: 'sku',
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
        emptyMessage="No receiving records found for this supplier"
        minWidth={600}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
