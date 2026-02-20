import { useState, useCallback, useEffect } from 'react';
import { SimpleGrid, Table, Text, LoadingOverlay, Box, Checkbox, TextInput, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { MetricCard } from './components/MetricCard';

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'SKU', key: 'sku' },
  { header: 'Description', key: 'description' },
  { header: 'Category', key: 'category' },
  { header: 'Location', key: 'location' },
  { header: 'Quantity', key: 'quantity', format: 'number' },
  { header: 'Cost', key: 'cost', format: 'currency' },
  { header: 'Price', key: 'price', format: 'currency' },
  { header: 'Total Cost', key: 'totalCost', format: 'currency' },
  { header: 'Total Retail', key: 'totalRetail', format: 'currency' },
];

interface InventoryValuationItem {
  sku: string;
  description: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  cost: number;
  price: number;
  totalCost: number;
  totalRetail: number;
}

interface InventoryValuationData {
  items: InventoryValuationItem[];
  totalItems: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialMargin: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function InventoryValuationReport() {
  const [data, setData] = useState<InventoryValuationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { lowStockOnly };
      if (categoryFilter.trim()) params.category = categoryFilter.trim();

      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_VALUATION_REPORT, params);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory valuation:', error);
    } finally {
      setLoading(false);
    }
  }, [lowStockOnly, categoryFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <ReportShell
      title="Inventory Valuation"
      loading={loading}
      onRefresh={fetchReport}
      actions={
        <Group gap="sm" className="no-print">
          <TextInput
            placeholder="Filter by category..."
            leftSection={<IconSearch size={14} />}
            size="sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.currentTarget.value)}
            maw={200}
          />
          <Checkbox
            label="Low stock only"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.currentTarget.checked)}
            size="sm"
          />
        </Group>
      }
      exportColumns={EXPORT_COLUMNS}
      exportRows={data?.items as Record<string, unknown>[] | undefined}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="lg">
              <MetricCard label="Total Items" value={data.totalItems} />
              <MetricCard label="Total Cost Value" value={formatCurrency(data.totalCostValue)} color="blue" />
              <MetricCard label="Total Retail Value" value={formatCurrency(data.totalRetailValue)} color="teal" />
              <MetricCard
                label="Potential Margin"
                value={formatCurrency(data.potentialMargin)}
                color={data.potentialMargin >= 0 ? 'green' : 'red'}
              />
            </SimpleGrid>

            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Location</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                  <Table.Th ta="right">Cost</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th ta="right">Total Cost</Table.Th>
                  <Table.Th ta="right">Total Retail</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((item) => (
                  <Table.Tr key={item.sku}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{item.sku}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" truncate maw={200}>{item.description || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.category || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.location || '—'}</Text>
                    </Table.Td>
                    <Table.Td ta="right">{item.quantity}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(item.cost)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(item.price)}</Table.Td>
                    <Table.Td ta="right" fw={500}>{formatCurrency(item.totalCost)}</Table.Td>
                    <Table.Td ta="right" fw={500}>{formatCurrency(item.totalRetail)}</Table.Td>
                  </Table.Tr>
                ))}
                {data.items.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={9} ta="center" c="dimmed" py="lg">
                      No inventory items found matching the filters.
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Box>
    </ReportShell>
  );
}
