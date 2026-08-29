import { useState, useEffect, useCallback, useMemo } from 'react';
import { SimpleGrid, Table, Text, LoadingOverlay, Box, Badge, TextInput, Select, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';
import { MetricCard } from './components/MetricCard';

interface AgingBucket {
  label: string;
  total: number;
  count: number;
}

interface AgingLineItem {
  invoiceId: number;
  invNumber: string;
  invDate: string;
  clientName: string | null;
  total: number;
  totalPaid: number;
  balance: number;
  daysOutstanding: number;
  bucket: string;
}

interface ReceivablesAgingData {
  buckets: AgingBucket[];
  invoices: AgingLineItem[];
  grandTotal: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const bucketColors: Record<string, string> = {
  'Current (0-30)': 'green',
  '31-60 days': 'yellow',
  '61-90 days': 'orange',
  '90+ days': 'red',
};

const BUCKET_OPTIONS = ['Current (0-30)', '31-60 days', '61-90 days', '90+ days'];

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Invoice #', key: 'invNumber' },
  { header: 'Client', key: 'clientName' },
  { header: 'Date', key: 'invDate', format: 'date' },
  { header: 'Total', key: 'total', format: 'currency' },
  { header: 'Paid', key: 'totalPaid', format: 'currency' },
  { header: 'Balance', key: 'balance', format: 'currency' },
  { header: 'Days Outstanding', key: 'daysOutstanding', format: 'number' },
  { header: 'Bucket', key: 'bucket' },
];

export function ReceivablesAgingReport() {
  const [data, setData] = useState<ReceivablesAgingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [clientFilter, setClientFilter] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_RECEIVABLES_AGING_REPORT);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch aging report:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const filteredInvoices = useMemo(() => {
    if (!data) return [];
    let list = data.invoices;
    if (clientFilter.trim()) {
      const q = clientFilter.trim().toLowerCase();
      list = list.filter((inv) => inv.clientName?.toLowerCase().includes(q));
    }
    if (bucketFilter) {
      list = list.filter((inv) => inv.bucket === bucketFilter);
    }
    return list;
  }, [data, clientFilter, bucketFilter]);

  return (
    <ReportShell
      title="Accounts Receivable Aging"
      onRefresh={fetchReport}
      loading={loading}
      exportColumns={EXPORT_COLUMNS}
      exportRows={filteredInvoices as unknown as Record<string, unknown>[]}
      actions={
        <Group gap="sm" className="no-print">
          <TextInput
            placeholder="Filter by client..."
            leftSection={<IconSearch size={14} />}
            size="sm"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.currentTarget.value)}
            maw={200}
          />
          <Select
            placeholder="All buckets"
            data={BUCKET_OPTIONS}
            value={bucketFilter}
            onChange={setBucketFilter}
            clearable
            size="sm"
            maw={160}
          />
        </Group>
      }
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <>
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="md" mb="lg">
              {data.buckets.map((bucket) => (
                <MetricCard
                  key={bucket.label}
                  label={`${bucket.label} (${bucket.count})`}
                  value={formatCurrency(bucket.total)}
                  color={bucketColors[bucket.label]}
                />
              ))}
              <MetricCard
                label="Grand Total"
                value={formatCurrency(data.grandTotal)}
                color="red"
              />
            </SimpleGrid>

            <Text fw={600} mb="xs">Outstanding Invoices ({filteredInvoices.length})</Text>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice #</Table.Th>
                  <Table.Th>Client</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th ta="right">Paid</Table.Th>
                  <Table.Th ta="right">Balance</Table.Th>
                  <Table.Th ta="right">Days</Table.Th>
                  <Table.Th>Bucket</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredInvoices.map((inv) => (
                  <Table.Tr key={inv.invoiceId}>
                    <Table.Td>{inv.invNumber}</Table.Td>
                    <Table.Td>{inv.clientName || '-'}</Table.Td>
                    <Table.Td>{inv.invDate}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(inv.total)}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(inv.totalPaid)}</Table.Td>
                    <Table.Td ta="right" fw={600}>{formatCurrency(inv.balance)}</Table.Td>
                    <Table.Td ta="right">{inv.daysOutstanding}</Table.Td>
                    <Table.Td>
                      <Badge color={bucketColors[inv.bucket]} variant="light" size="sm">
                        {inv.bucket}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8} ta="center" c="dimmed" py="lg">
                      No outstanding invoices found.
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
