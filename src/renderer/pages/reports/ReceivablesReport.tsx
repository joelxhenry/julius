import { useState, useCallback, useMemo } from 'react';
import { Table, Text, LoadingOverlay, Box, Button, Badge, Group } from '@mantine/core';
import { IpcChannel } from '../../../shared/types/ipc';
import type { ExportColumn } from '../../../shared/types/export';
import { ReportShell } from './components/ReportShell';

// Aging buckets, in days past the client's allowed terms. Mirrors the backend
// AGING_BUCKETS ordering (see src/main/services/receivablesAging.ts).
const BUCKETS = [
  { key: 'd0_14', label: '0-14 Days' },
  { key: 'd15_29', label: '15-29 Days' },
  { key: 'd30_59', label: '30-59 Days' },
  { key: 'd60_89', label: '60-89 Days' },
  { key: 'd90_plus', label: '+90 Days' },
] as const;

type BucketAmounts = Record<(typeof BUCKETS)[number]['key'], number>;

interface ReceivablesRow {
  clientId: number;
  clientName: string;
  clNumber: string | null;
  buckets: BucketAmounts;
  totalOverdue: number;
  isBadCredit: boolean;
}

interface ReceivablesData {
  asOf: string;
  rows: ReceivablesRow[];
  totals: BucketAmounts & { totalOverdue: number };
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Customer', key: 'clientName', format: 'text' },
  { header: '0-14 Days', key: 'd0_14', format: 'currency' },
  { header: '15-29 Days', key: 'd15_29', format: 'currency' },
  { header: '30-59 Days', key: 'd30_59', format: 'currency' },
  { header: '60-89 Days', key: 'd60_89', format: 'currency' },
  { header: '+90 Days', key: 'd90_plus', format: 'currency' },
  { header: 'Total Overdue', key: 'totalOverdue', format: 'currency' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

/** Blank out zero amounts so the table reads like the legacy printout. */
const cell = (value: number) => (value ? formatCurrency(value) : '—');

export function ReceivablesReport() {
  const [data, setData] = useState<ReceivablesData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_RECEIVABLES_REPORT);
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch receivables report:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const exportRows = useMemo(() => {
    if (!data) return undefined;
    const rows = data.rows.map((r) => ({
      clientName: r.clientName,
      ...r.buckets,
      totalOverdue: r.totalOverdue,
    }));
    rows.push({
      clientName: 'TOTALS',
      ...data.totals,
      totalOverdue: data.totals.totalOverdue,
    });
    return rows as unknown as Record<string, unknown>[];
  }, [data]);

  const actions = (
    <Button variant="filled" size="sm" onClick={fetchReport} loading={loading}>
      Generate
    </Button>
  );

  return (
    <ReportShell
      title="Receivables Summary"
      actions={actions}
      exportColumns={EXPORT_COLUMNS}
      exportRows={exportRows}
      exportFileName={data ? `Receivables Summary as of ${data.asOf}` : 'Receivables Summary'}
      loading={loading}
    >
      <Box pos="relative" mih={200}>
        <LoadingOverlay visible={loading} />

        {data && (
          <>
            <Group justify="space-between" mb="sm">
              <Text size="sm" c="dimmed">
                Amounts owing past each client&apos;s allowed credit terms, as of {data.asOf}.
              </Text>
              <Text size="sm" c="dimmed">
                {data.rows.length} client{data.rows.length === 1 ? '' : 's'} in arrears
              </Text>
            </Group>

            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer</Table.Th>
                  {BUCKETS.map((b) => (
                    <Table.Th key={b.key} ta="right">
                      {b.label}
                    </Table.Th>
                  ))}
                  <Table.Th ta="right">Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.rows.map((r) => (
                  <Table.Tr key={r.clientId}>
                    <Table.Td fw={500}>
                      <Group gap="xs" wrap="nowrap">
                        <span>{r.clientName}</span>
                        <Badge color="orange" variant="light" size="xs">
                          In Arrears
                        </Badge>
                        {r.isBadCredit && (
                          <Badge color="red" variant="light" size="xs">
                            Bad Credit
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    {BUCKETS.map((b) => (
                      <Table.Td key={b.key} ta="right" c={b.key === 'd90_plus' && r.buckets[b.key] ? 'red' : undefined}>
                        {cell(r.buckets[b.key])}
                      </Table.Td>
                    ))}
                    <Table.Td ta="right" fw={600}>
                      {formatCurrency(r.totalOverdue)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Th>Totals</Table.Th>
                  {BUCKETS.map((b) => (
                    <Table.Th key={b.key} ta="right">
                      {formatCurrency(data.totals[b.key])}
                    </Table.Th>
                  ))}
                  <Table.Th ta="right">{formatCurrency(data.totals.totalOverdue)}</Table.Th>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </>
        )}

        {data && data.rows.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No clients are currently past their credit terms.
          </Text>
        )}

        {!data && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            Click Generate to view outstanding receivables by age.
          </Text>
        )}
      </Box>
    </ReportShell>
  );
}
