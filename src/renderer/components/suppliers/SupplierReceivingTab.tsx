import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Paper,
  Text,
  Stack,
  Group,
  Button,
  Badge,
  Center,
  Pagination,
  Modal,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFilterOff,
  IconEye,
  IconDownload,
  IconFileTypeCsv,
  IconFileSpreadsheet,
  IconPrinter,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { DataTable, Column } from '../common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../common/DateRangeFilter';
import { useReceivingReferencePrint } from '../../hooks/useReceivingReferencePrint';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn, ExportFormat, ExportRequest } from '../../../shared/types/export';

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

interface ReceivingGroup {
  key: string;
  reference: string | null;
  totalQuantity: number;
  latestDate: string;
  skuCount: number;
  records: InventoryReceiving[];
}

interface SupplierReceivingTabProps {
  supplierId: number;
}

const GROUPS_PER_PAGE = 8;

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

export function SupplierReceivingTab({ supplierId }: SupplierReceivingTabProps) {
  const { printReceivingReference, isPrinting } = useReceivingReferencePrint();
  const [receiving, setReceiving] = useState<InventoryReceiving[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const [page, setPage] = useState(1);
  const [viewGroup, setViewGroup] = useState<ReceivingGroup | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  const handlePrint = useCallback(
    async (reference: string, mode: 'print' | 'pdf' | 'preview') => {
      setPrintingKey(reference);
      try {
        await printReceivingReference(reference, mode);
      } finally {
        setPrintingKey(null);
      }
    },
    [printReceivingReference]
  );

  const loadReceiving = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(
        IpcChannel.GET_INVENTORY_RECEIVING_BY_SUPPLIER_ALL,
        { supplierId }
      );
      if (result.success && result.data) {
        setReceiving(result.data);
      }
    } catch (error) {
      console.error('Failed to load receiving:', error);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    loadReceiving();
  }, [loadReceiving]);

  const hasActiveFilters = dateRange[0] !== null || dateRange[1] !== null;

  // Apply the date-range filter against the receiving date (YYYY-MM-DD portion).
  const filtered = useMemo(() => {
    const [from, to] = dateRange;
    if (!from && !to) return receiving;
    return receiving.filter((row) => {
      if (!row.receivingDate) return false;
      const day = row.receivingDate.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [receiving, dateRange]);

  // Group the filtered records by reference number, most recent group first.
  const groups = useMemo<ReceivingGroup[]>(() => {
    const map = new Map<string, InventoryReceiving[]>();
    for (const row of filtered) {
      const key = row.reference?.trim() || '__none__';
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        map.set(key, [row]);
      }
    }

    return Array.from(map.entries())
      .map(([key, records]) => ({
        key,
        reference: key === '__none__' ? null : key,
        totalQuantity: records.reduce((sum, r) => sum + (r.quantity || 0), 0),
        skuCount: new Set(records.map((r) => r.sku)).size,
        latestDate: records.reduce((max, r) => {
          const day = r.receivingDate ?? '';
          return day > max ? day : max;
        }, ''),
        records,
      }))
      .sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const pagedGroups = groups.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE);

  // Keep the page in range as the filtered result set shrinks.
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const handleDateRangeChange = (range: DateRangeValue) => {
    setDateRange(range);
    setPage(1);
  };

  const clearFilters = () => {
    setDateRange([null, null]);
    setPage(1);
  };

  const handleExport = useCallback(
    async (group: ReceivingGroup, format: ExportFormat) => {
      setExportingKey(group.key);
      try {
        const columns: ExportColumn[] = [
          { header: 'Date', key: 'date', format: 'text' },
          { header: 'Part Number', key: 'sku', format: 'text' },
          { header: 'Quantity', key: 'quantity', format: 'number' },
          { header: 'Unit Cost', key: 'unitCost', format: 'text' },
          { header: 'Prior Cost', key: 'priorCost', format: 'text' },
          { header: 'Selling Price', key: 'sellingPrice', format: 'text' },
          { header: 'Reference', key: 'reference', format: 'text' },
        ];
        const rows = group.records.map((r) => ({
          date: formatDate(r.receivingDate),
          sku: r.sku,
          quantity: r.quantity ?? 0,
          unitCost: formatCurrency(r.lastCost, r.lastCostCurrency),
          priorCost: formatCurrency(r.priorCost, r.priorCostCurrency),
          sellingPrice: formatCurrency(r.lastPrice, r.lastPriceCurrency),
          reference: r.reference ?? '',
        }));

        const refLabel = group.reference ? `Ref-${group.reference}` : 'No-Reference';
        const request: ExportRequest = {
          fileName: `Receiving ${refLabel}`,
          format,
          columns,
          rows,
          sheetName: 'Receiving',
        };

        const result = await window.electron.invoke(IpcChannel.EXPORT_REPORT, request);
        if (result?.data?.cancelled) return;
        notifications.show({
          title: 'Export complete',
          message: `Exported ${rows.length} record${rows.length === 1 ? '' : 's'}.`,
          color: 'green',
        });
      } catch (error) {
        console.error('Export failed:', error);
        notifications.show({
          title: 'Export failed',
          message: 'Could not export receiving records.',
          color: 'red',
        });
      } finally {
        setExportingKey(null);
      }
    },
    []
  );

  // Columns for the "View" dialog table; reference lives in the header.
  const columns: Column<InventoryReceiving>[] = useMemo(
    () => [
      {
        key: 'receivingDate',
        header: 'Date',
        width: 130,
        render: (row) => formatDate(row.receivingDate),
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
        width: 110,
        render: (row) => (
          <Text c="green" fw={500}>
            +{row.quantity || 0}
          </Text>
        ),
      },
      {
        key: 'lastCost',
        header: 'Unit Cost',
        width: 130,
        render: (row) => formatCurrency(row.lastCost, row.lastCostCurrency),
      },
      {
        key: 'lastPrice',
        header: 'Selling Price',
        render: (row) => formatCurrency(row.lastPrice, row.lastPriceCurrency),
      },
    ],
    []
  );

  return (
    <Stack gap="md">
      <Paper p="md" radius="md" withBorder>
        <Group gap="md" align="flex-end" wrap="wrap">
          <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} />
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

      {loading ? (
        <Paper p="xl" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            Loading receiving records…
          </Text>
        </Paper>
      ) : groups.length === 0 ? (
        <Paper p="xl" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            No receiving records found for this supplier
          </Text>
        </Paper>
      ) : (
        <>
          {pagedGroups.map((group) => {
            const reference = group.reference;
            return (
              <Paper key={group.key} p="md" radius="md" withBorder>
                <Group justify="space-between" wrap="wrap" gap="sm">
                  <Group gap="sm">
                    <Text fw={600} size="sm">
                      {group.reference ? `Reference #${group.reference}` : 'No Reference'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatDate(group.latestDate || null)}
                    </Text>
                    <Badge variant="light" color="green">
                      +{group.totalQuantity} total
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {group.skuCount} part{group.skuCount === 1 ? '' : 's'} ·{' '}
                      {group.records.length} record{group.records.length === 1 ? '' : 's'}
                    </Text>
                  </Group>

                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconEye size={14} />}
                      onClick={() => setViewGroup(group)}
                    >
                      View
                    </Button>
                    <Menu shadow="md" width={180} position="bottom-end">
                      <Menu.Target>
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          leftSection={<IconDownload size={14} />}
                          loading={exportingKey === group.key}
                        >
                          Export
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconFileTypeCsv size={16} />}
                          onClick={() => handleExport(group, 'csv')}
                        >
                          Export as CSV
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconFileSpreadsheet size={16} />}
                          onClick={() => handleExport(group, 'xlsx')}
                        >
                          Export as Excel
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                    {reference && (
                      <Menu shadow="md" width={180} position="bottom-end">
                        <Menu.Target>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconPrinter size={14} />}
                            loading={printingKey === reference}
                            disabled={isPrinting && printingKey !== reference}
                          >
                            Print
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconPrinter size={16} />}
                            onClick={() => handlePrint(reference, 'print')}
                          >
                            Print
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconFileTypePdf size={16} />}
                            onClick={() => handlePrint(reference, 'pdf')}
                          >
                            Save as PDF
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconEye size={16} />}
                            onClick={() => handlePrint(reference, 'preview')}
                          >
                            Preview
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    )}
                  </Group>
                </Group>
              </Paper>
            );
          })}

          {totalPages > 1 && (
            <Center>
              <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
            </Center>
          )}
        </>
      )}

      <Modal
        opened={viewGroup !== null}
        onClose={() => setViewGroup(null)}
        size="xl"
        title={viewGroup?.reference ? `Reference #${viewGroup.reference}` : 'Receiving Records'}
      >
        {viewGroup && (
          <Stack gap="md">
            <Group gap="sm" wrap="wrap">
              <Badge variant="light" color="green">
                +{viewGroup.totalQuantity} total
              </Badge>
              <Text size="sm" c="dimmed">
                {viewGroup.skuCount} part{viewGroup.skuCount === 1 ? '' : 's'}
              </Text>
            </Group>
            <DataTable
              columns={columns}
              data={viewGroup.records}
              loading={false}
              keyField="id"
              minWidth={600}
              verticalSpacing="md"
              horizontalSpacing="lg"
            />
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
