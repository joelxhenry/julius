import { ReactNode, useCallback, useState } from 'react';
import { Stack, Group, Title, Button, Menu } from '@mantine/core';
import { DateInput, DatePickerInput } from '@mantine/dates';
import { IconDownload, IconFileTypeCsv, IconFileSpreadsheet } from '@tabler/icons-react';
import { IpcChannel } from '../../../../shared/types/ipc';
import type { ExportColumn, ExportFormat, ExportRequest } from '../../../../shared/types/export';

interface ReportShellProps {
  title: string;
  showDateRange?: boolean;
  startDate?: Date | null;
  endDate?: Date | null;
  onStartDateChange?: (date: Date | null) => void;
  onEndDateChange?: (date: Date | null) => void;
  loading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  exportColumns?: ExportColumn[];
  exportRows?: Record<string, unknown>[];
  exportFileName?: string;
  /** Use a single range picker instead of separate From/To inputs. */
  rangePicker?: boolean;
}

/** Local-midnight Date -> 'YYYY-MM-DD' (Mantine 8 dates use string values). */
function toDateString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' -> local-midnight Date, avoiding UTC day-shift. */
function parseLocalDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function ReportShell({
  title,
  showDateRange = false,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  loading,
  onRefresh,
  actions,
  children,
  exportColumns,
  exportRows,
  exportFileName,
  rangePicker = false,
}: ReportShellProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!exportColumns || !exportRows || exportRows.length === 0) return;

      setExporting(true);
      try {
        let fileName = exportFileName || title;
        if (startDate || endDate) {
          const from = startDate ? new Date(startDate).toISOString().split('T')[0] : '';
          const to = endDate ? new Date(endDate).toISOString().split('T')[0] : '';
          if (from && to) fileName += ` ${from} to ${to}`;
          else if (from) fileName += ` from ${from}`;
          else if (to) fileName += ` to ${to}`;
        }

        const request: ExportRequest = {
          fileName,
          format,
          columns: exportColumns,
          rows: exportRows,
          sheetName: title,
        };

        await window.electron.invoke(IpcChannel.EXPORT_REPORT, request);
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setExporting(false);
      }
    },
    [exportColumns, exportRows, exportFileName, title, startDate, endDate],
  );

  const canExport = exportColumns && exportRows && exportRows.length > 0;

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>{title}</Title>
        <Group gap="sm" className="no-print">
          {actions}
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                disabled={!canExport || loading}
                loading={exporting}
              >
                Export
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
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
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      {/* Date range */}
      {showDateRange && (
        <Group gap="md" className="no-print" align="flex-end">
          {rangePicker ? (
            <DatePickerInput
              type="range"
              label="Date range"
              placeholder="Pick dates"
              value={[toDateString(startDate), toDateString(endDate)]}
              onChange={(value) => {
                onStartDateChange?.(parseLocalDate(value[0]));
                onEndDateChange?.(parseLocalDate(value[1]));
              }}
              clearable
              allowSingleDateInRange
              size="sm"
              miw={260}
            />
          ) : (
            <>
              <DateInput
                label="From"
                value={startDate}
                onChange={onStartDateChange}
                clearable
                size="sm"
                maw={180}
              />
              <DateInput
                label="To"
                value={endDate}
                onChange={onEndDateChange}
                clearable
                size="sm"
                maw={180}
              />
            </>
          )}
          {onRefresh && (
            <Button
              variant="filled"
              size="sm"
              onClick={onRefresh}
              loading={loading}
            >
              Generate
            </Button>
          )}
        </Group>
      )}

      {/* Report content */}
      {children}
    </Stack>
  );
}
