import { useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Table,
  ScrollArea,
  Badge,
  Modal,
  Alert,
  Divider,
  Progress,
  TextInput,
  FileButton,
  List,
  ThemeIcon,
} from '@mantine/core';
import {
  IconUpload,
  IconDownload,
  IconCheck,
  IconAlertCircle,
  IconArrowRight,
  IconRotateClockwise,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconCircleCheck,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { IpcChannel } from '../../../shared/types/ipc';

type Stage = 'upload' | 'preview' | 'applying' | 'summary';

type FieldKey = 'quantity' | 'price' | 'cost' | 'category' | 'model' | 'minLevel';

type RowStatus = 'valid' | 'invalid' | 'unchanged' | 'applying' | 'success' | 'failed';

interface UpdateField {
  key: FieldKey;
  before: string | number | null;
  after: string | number | null;
}

interface ParsedRow {
  rowIndex: number; // 1-based row number from the source file (excluding header)
  partNumber: string;
  raw: Record<FieldKey, string | undefined>;
  current: {
    id: number;
    quantity: number;
    price: string;
    cost: string;
    category: string | null;
    model: string | null;
    minLevel: number;
    description1: string | null;
  } | null;
  changes: UpdateField[];
  errors: string[];
  status: RowStatus;
  applyError?: string;
}

interface RowOutcome {
  partNumber: string;
  ok: boolean;
  changed: number;
  error?: string;
}

const COLUMN_HEADERS: Record<FieldKey, string> = {
  quantity: 'Quantity On Hand',
  price: 'Unit Price',
  cost: 'Cost Price',
  category: 'Category',
  model: 'Model',
  minLevel: 'Min Level',
};

// Header aliases the importer accepts (case-insensitive, trimmed). Matches the
// CSV-template header on download plus a couple of common alternates.
const HEADER_ALIASES: Record<string, FieldKey | 'sku'> = {
  'part number': 'sku',
  'part no': 'sku',
  'part no.': 'sku',
  sku: 'sku',
  'quantity on hand': 'quantity',
  quantity: 'quantity',
  qty: 'quantity',
  'on hand': 'quantity',
  'unit price': 'price',
  price: 'price',
  'cost price': 'cost',
  cost: 'cost',
  category: 'category',
  model: 'model',
  'min level': 'minLevel',
  'minimum level': 'minLevel',
  minlevel: 'minLevel',
};

const FIELD_KEYS: FieldKey[] = ['quantity', 'price', 'cost', 'category', 'model', 'minLevel'];

const REASON_MAX = 50;

const blankCell = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '—';
  return String(val);
};

type NormalizeResult<T> = { ok: true; value: T } | { ok: false; error: string };

const normalizeMoney = (raw: string): NormalizeResult<string> => {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '') return { ok: false, error: 'Empty value' };
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return { ok: false, error: `"${raw}" is not a number` };
  if (num < 0) return { ok: false, error: 'Cannot be negative' };
  return { ok: true, value: num.toFixed(2) };
};

const normalizeInt = (raw: string): NormalizeResult<number> => {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return { ok: false, error: 'Empty value' };
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return { ok: false, error: `"${raw}" is not a number` };
  if (!Number.isInteger(num)) return { ok: false, error: `"${raw}" must be a whole number` };
  if (num < 0) return { ok: false, error: 'Cannot be negative' };
  return { ok: true, value: num };
};

// Compare current and incoming numeric strings (price/cost) by numeric value
// so that "10" and "10.00" don't show as a change.
const moneyEqual = (a: string | null, b: string | null): boolean => {
  const na = a === null ? null : Number(a);
  const nb = b === null ? null : Number(b);
  if (na === null && nb === null) return true;
  if (na === null || nb === null) return false;
  return Math.abs(na - nb) < 0.005;
};

interface ParseResult {
  rows: { partNumber: string; values: Partial<Record<FieldKey, string>>; sourceRow: number }[];
  fileError?: string;
  unknownColumns: string[];
}

const parseFile = async (file: File): Promise<ParseResult> => {
  try {
    const buffer = await file.arrayBuffer();
    // xlsx auto-detects CSV vs XLSX from the buffer contents
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { rows: [], unknownColumns: [], fileError: 'No sheets found in file' };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const aoa: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (aoa.length === 0) {
      return { rows: [], unknownColumns: [], fileError: 'File is empty' };
    }
    const headerRow = (aoa[0] as unknown[]).map((h) => String(h ?? '').trim());
    if (headerRow.every((h) => h === '')) {
      return { rows: [], unknownColumns: [], fileError: 'Header row is empty' };
    }

    const columnMap: ({ key: FieldKey | 'sku' } | null)[] = headerRow.map((h) => {
      const norm = h.toLowerCase().trim();
      const matched = HEADER_ALIASES[norm];
      return matched ? { key: matched } : null;
    });
    const unknownColumns = headerRow.filter((h, i) => h !== '' && columnMap[i] === null);

    const skuColIndex = columnMap.findIndex((c) => c?.key === 'sku');
    if (skuColIndex === -1) {
      return {
        rows: [],
        unknownColumns,
        fileError:
          'Required "Part Number" column not found. Download the template to see the expected format.',
      };
    }

    const rows: ParseResult['rows'] = [];
    for (let r = 1; r < aoa.length; r += 1) {
      const dataRow = aoa[r] as unknown[];
      // Skip empty rows
      const isEmpty = dataRow.every((cell) => String(cell ?? '').trim() === '');
      if (isEmpty) continue;
      const partNumber = String(dataRow[skuColIndex] ?? '').trim();
      const values: Partial<Record<FieldKey, string>> = {};
      columnMap.forEach((col, i) => {
        if (!col) return;
        if (col.key === 'sku') return;
        const raw = String(dataRow[i] ?? '').trim();
        if (raw !== '') values[col.key] = raw;
      });
      rows.push({ partNumber, values, sourceRow: r + 1 });
    }

    return { rows, unknownColumns };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to parse file';
    return { rows: [], unknownColumns: [], fileError: message };
  }
};

const downloadTemplate = (format: 'csv' | 'xlsx') => {
  const headers = ['Part Number', ...FIELD_KEYS.map((k) => COLUMN_HEADERS[k])];
  const example = ['ABC-123', '10', '199.99', '120.00', 'Filters', 'Model-X', '2'];
  const aoa = [headers, example];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mass Update Template');
  const bookType: XLSX.BookType = format === 'xlsx' ? 'xlsx' : 'csv';
  const buffer: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType });
  const mime =
    format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv';
  const blob = new Blob([buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `mass-update-template.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const downloadErrorReport = (rows: ParsedRow[]) => {
  const failed = rows.filter((r) => r.status === 'failed' || r.status === 'invalid');
  if (failed.length === 0) return;
  const headers = ['Part Number', 'Source Row', 'Reason'];
  const aoa = [
    headers,
    ...failed.map((r) => [
      r.partNumber || '(blank)',
      String(r.rowIndex),
      r.applyError || r.errors.join('; ') || 'Unknown error',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  const buffer: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'csv' });
  const blob = new Blob([buffer], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mass-update-errors.csv';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export function MassUpdatePage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('upload');
  const [parseError, setParseError] = useState<string | null>(null);
  const [unknownColumns, setUnknownColumns] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [reason, setReason] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  const [fileResetKey, setFileResetKey] = useState(0);

  const validRows = useMemo(
    () => parsedRows.filter((r) => r.status === 'valid'),
    [parsedRows],
  );
  const invalidRows = useMemo(
    () => parsedRows.filter((r) => r.status === 'invalid'),
    [parsedRows],
  );
  const unchangedRows = useMemo(
    () => parsedRows.filter((r) => r.status === 'unchanged'),
    [parsedRows],
  );
  const hasQuantityChange = useMemo(
    () => validRows.some((r) => r.changes.some((c) => c.key === 'quantity')),
    [validRows],
  );

  const resetAll = () => {
    setStage('upload');
    setParseError(null);
    setUnknownColumns([]);
    setParsedRows([]);
    setReason('');
    setProgress({ done: 0, total: 0 });
    setOutcomes([]);
    setFileResetKey((k) => k + 1);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setUnknownColumns([]);

    const parsed = await parseFile(file);
    setUnknownColumns(parsed.unknownColumns);
    if (parsed.fileError) {
      setParseError(parsed.fileError);
      setBusy(false);
      return;
    }
    if (parsed.rows.length === 0) {
      setParseError('No data rows found in file.');
      setBusy(false);
      return;
    }

    // Look up each part number in inventory and build per-row diff.
    const built: ParsedRow[] = [];
    for (const r of parsed.rows) {
      const errors: string[] = [];
      const raw: ParsedRow['raw'] = {
        quantity: r.values.quantity,
        price: r.values.price,
        cost: r.values.cost,
        category: r.values.category,
        model: r.values.model,
        minLevel: r.values.minLevel,
      };

      if (!r.partNumber) {
        built.push({
          rowIndex: r.sourceRow,
          partNumber: '',
          raw,
          current: null,
          changes: [],
          errors: ['Part Number is missing'],
          status: 'invalid',
        });
        continue;
      }

      let current: ParsedRow['current'] = null;
      try {
        const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, {
          sku: r.partNumber,
        });
        if (result.success && result.data) {
          const item = result.data;
          current = {
            id: item.id,
            quantity: Number(item.quantity ?? 0),
            price: String(item.price ?? '0'),
            cost: String(item.cost ?? '0'),
            category: item.category ?? null,
            model: item.model ?? null,
            minLevel: Number(item.minLevel ?? 0),
            description1: item.description1 ?? null,
          };
        } else {
          errors.push(`Part Number "${r.partNumber}" not found in inventory`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lookup failed';
        errors.push(`Lookup failed: ${message}`);
      }

      const changes: UpdateField[] = [];
      if (current) {
        // Validate and diff each provided field
        if (raw.quantity !== undefined) {
          const v = normalizeInt(raw.quantity);
          if (!v.ok) errors.push(`Quantity On Hand: ${v.error}`);
          else if (v.value !== current.quantity) {
            changes.push({ key: 'quantity', before: current.quantity, after: v.value });
          }
        }
        if (raw.price !== undefined) {
          const v = normalizeMoney(raw.price);
          if (!v.ok) errors.push(`Unit Price: ${v.error}`);
          else if (!moneyEqual(current.price, v.value)) {
            changes.push({ key: 'price', before: current.price, after: v.value });
          }
        }
        if (raw.cost !== undefined) {
          const v = normalizeMoney(raw.cost);
          if (!v.ok) errors.push(`Cost Price: ${v.error}`);
          else if (!moneyEqual(current.cost, v.value)) {
            changes.push({ key: 'cost', before: current.cost, after: v.value });
          }
        }
        if (raw.minLevel !== undefined) {
          const v = normalizeInt(raw.minLevel);
          if (!v.ok) errors.push(`Min Level: ${v.error}`);
          else if (v.value !== current.minLevel) {
            changes.push({ key: 'minLevel', before: current.minLevel, after: v.value });
          }
        }
        if (raw.category !== undefined) {
          const next = raw.category;
          if (next !== (current.category ?? '')) {
            changes.push({ key: 'category', before: current.category, after: next });
          }
        }
        if (raw.model !== undefined) {
          const next = raw.model;
          if (next !== (current.model ?? '')) {
            changes.push({ key: 'model', before: current.model, after: next });
          }
        }
      }

      let status: RowStatus;
      if (errors.length > 0) status = 'invalid';
      else if (changes.length === 0) status = 'unchanged';
      else status = 'valid';

      built.push({
        rowIndex: r.sourceRow,
        partNumber: r.partNumber,
        raw,
        current,
        changes,
        errors,
        status,
      });
    }

    setParsedRows(built);
    setStage('preview');
    setBusy(false);

    const validCount = built.filter((b) => b.status === 'valid').length;
    const invalidCount = built.filter((b) => b.status === 'invalid').length;
    notifications.show({
      title: 'File parsed',
      message: `${validCount} row${validCount === 1 ? '' : 's'} ready to apply, ${invalidCount} with errors.`,
      color: invalidCount === 0 ? 'green' : 'yellow',
      icon: invalidCount === 0 ? <IconCheck size={16} /> : <IconAlertCircle size={16} />,
    });
  };

  const handleApply = () => {
    if (validRows.length === 0) {
      notifications.show({
        title: 'Nothing to apply',
        message: 'No valid changes detected. Fix errors or upload a different file.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    if (hasQuantityChange && !reason.trim()) {
      notifications.show({
        title: 'Reason required',
        message:
          'A reason note is required for any quantity adjustment so it can be recorded in the audit trail.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    openConfirm();
  };

  const handleConfirm = async () => {
    closeConfirm();
    setStage('applying');
    setBusy(true);
    setProgress({ done: 0, total: validRows.length });

    const today = new Date().toISOString().split('T')[0];
    const trimmedReason = reason.trim().slice(0, REASON_MAX);
    const summary: RowOutcome[] = [];
    const updates: Record<number, { status: RowStatus; applyError?: string }> = {};

    for (let i = 0; i < validRows.length; i += 1) {
      const row = validRows[i];
      if (!row.current) continue;

      // Mark this row as applying (so it shows status while loop runs)
      setParsedRows((prev) =>
        prev.map((r) => (r.rowIndex === row.rowIndex ? { ...r, status: 'applying' } : r)),
      );

      const fieldChanges = row.changes.filter((c) => c.key !== 'quantity');
      const quantityChange = row.changes.find((c) => c.key === 'quantity');
      let rowError: string | null = null;

      try {
        // 1. Apply field updates (price, cost, category, model, minLevel) via UPDATE_INVENTORY
        if (fieldChanges.length > 0) {
          const data: Record<string, unknown> = {};
          for (const c of fieldChanges) {
            if (c.key === 'category' || c.key === 'model') {
              data[c.key] = c.after === '' ? null : c.after;
            } else {
              data[c.key] = c.after;
            }
          }
          const result = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY, {
            id: row.current.id,
            data,
          });
          if (!result.success) {
            rowError = result.error || 'Field update failed';
          }
        }

        // 2. Apply quantity change via UPDATE_INVENTORY_STOCK + audit transaction
        if (!rowError && quantityChange) {
          const newQty = quantityChange.after as number;
          const delta = newQty - (quantityChange.before as number);
          const stockResult = await window.electron.invoke(
            IpcChannel.UPDATE_INVENTORY_STOCK,
            { id: row.current.id, quantity: newQty },
          );
          if (!stockResult.success) {
            rowError = stockResult.error || 'Stock update failed';
          } else {
            const txResult = await window.electron.invoke(
              IpcChannel.CREATE_INVENTORY_TRANSACTION,
              {
                sku: row.partNumber,
                activity: 'ADJ',
                reference: trimmedReason,
                quantity: delta,
                activityDate: today,
              },
            );
            if (!txResult.success) {
              rowError = `Stock updated, but audit log failed: ${txResult.error || 'unknown error'}`;
            }
          }
        }
      } catch (err) {
        rowError = err instanceof Error ? err.message : 'Unexpected error';
      }

      if (rowError) {
        updates[row.rowIndex] = { status: 'failed', applyError: rowError };
        summary.push({
          partNumber: row.partNumber,
          ok: false,
          changed: row.changes.length,
          error: rowError,
        });
      } else {
        updates[row.rowIndex] = { status: 'success' };
        summary.push({
          partNumber: row.partNumber,
          ok: true,
          changed: row.changes.length,
        });
      }

      setProgress({ done: i + 1, total: validRows.length });
    }

    setParsedRows((prev) =>
      prev.map((r) => {
        const upd = updates[r.rowIndex];
        if (!upd) return r;
        return { ...r, status: upd.status, applyError: upd.applyError };
      }),
    );
    setOutcomes(summary);
    setBusy(false);
    setStage('summary');
    openSummary();

    const ok = summary.filter((s) => s.ok).length;
    const fail = summary.length - ok;
    notifications.show({
      title: fail === 0 ? 'Mass update applied' : 'Mass update finished with errors',
      message:
        fail === 0
          ? `${ok} item${ok === 1 ? '' : 's'} updated successfully.`
          : `${ok} updated, ${fail} failed. Download the error report from the summary.`,
      color: fail === 0 ? 'green' : 'yellow',
      icon: fail === 0 ? <IconCheck size={16} /> : <IconAlertCircle size={16} />,
    });
  };

  const renderRowStatus = (row: ParsedRow) => {
    if (row.status === 'invalid') {
      return (
        <Badge size="sm" variant="light" color="red" leftSection={<IconAlertCircle size={12} />}>
          Error
        </Badge>
      );
    }
    if (row.status === 'unchanged') {
      return (
        <Badge size="sm" variant="light" color="gray">
          No change
        </Badge>
      );
    }
    if (row.status === 'applying') {
      return (
        <Badge size="sm" variant="light" color="blue">
          Applying…
        </Badge>
      );
    }
    if (row.status === 'success') {
      return (
        <Badge size="sm" variant="light" color="green" leftSection={<IconCheck size={12} />}>
          Updated
        </Badge>
      );
    }
    if (row.status === 'failed') {
      return (
        <Badge size="sm" variant="light" color="red" leftSection={<IconAlertCircle size={12} />}>
          Failed
        </Badge>
      );
    }
    return (
      <Badge size="sm" variant="light" color="yellow">
        {row.changes.length} change{row.changes.length === 1 ? '' : 's'}
      </Badge>
    );
  };

  const renderChanges = (row: ParsedRow) => {
    if (row.errors.length > 0) {
      return (
        <Stack gap={2}>
          {row.errors.map((e, i) => (
            <Text key={i} size="xs" c="red">
              {e}
            </Text>
          ))}
        </Stack>
      );
    }
    if (row.applyError) {
      return (
        <Text size="xs" c="red">
          {row.applyError}
        </Text>
      );
    }
    if (row.changes.length === 0) {
      return (
        <Text size="xs" c="dimmed" fs="italic">
          No fields differ from current values.
        </Text>
      );
    }
    return (
      <Stack gap={2}>
        {row.changes.map((c) => (
          <Group key={c.key} gap={6} wrap="nowrap">
            <Text size="xs" fw={500} w={120}>
              {COLUMN_HEADERS[c.key]}
            </Text>
            <Text size="xs" c="dimmed">
              {blankCell(c.before)}
            </Text>
            <IconArrowRight size={12} />
            <Text size="xs" fw={500}>
              {blankCell(c.after)}
            </Text>
          </Group>
        ))}
      </Stack>
    );
  };

  const okCount = outcomes.filter((o) => o.ok).length;
  const failCount = outcomes.length - okCount;

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Mass Update</Title>
          <Text c="dimmed" size="sm">
            Bulk-edit price, cost, quantity, category, model, and min level for many items via
            CSV / Excel import. Every change is previewed before any data is written.
          </Text>
        </Stack>
        <Group>
          {stage !== 'upload' && (
            <Button
              variant="subtle"
              leftSection={<IconRotateClockwise size={14} />}
              onClick={resetAll}
              disabled={busy}
            >
              Start Over
            </Button>
          )}
          <Button variant="subtle" onClick={() => navigate('/inventory/manage')}>
            Back
          </Button>
        </Group>
      </Group>

      {stage === 'upload' && (
        <>
          <Paper p="md" radius="md" withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text fw={600}>Step 1 — Download a template</Text>
                  <Text size="sm" c="dimmed">
                    Use the Part Number column to look up items. Leave a column blank to keep the
                    current value. Unknown columns are ignored with a warning.
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconFileTypeCsv size={14} />}
                    onClick={() => downloadTemplate('csv')}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconFileSpreadsheet size={14} />}
                    onClick={() => downloadTemplate('xlsx')}
                  >
                    Excel
                  </Button>
                </Group>
              </Group>
              <Divider my="xs" />
              <Text size="xs" c="dimmed">
                Editable columns: <strong>Part Number</strong> (required, used to match the
                existing item), Quantity On Hand, Unit Price, Cost Price, Category, Model, Min
                Level.
              </Text>
            </Stack>
          </Paper>

          <Paper p="md" radius="md" withBorder>
            <Stack gap="sm" align="center" py="lg">
              <ThemeIcon size={56} radius="xl" variant="light" color="blue">
                <IconUpload size={28} />
              </ThemeIcon>
              <Text fw={600}>Step 2 — Upload your file</Text>
              <Text size="sm" c="dimmed" ta="center" maw={500}>
                Choose a .csv, .xlsx, or .xls file. Nothing is written yet — you&apos;ll see
                a preview of every row before applying changes.
              </Text>
              <FileButton
                key={fileResetKey}
                onChange={handleFile}
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              >
                {(props) => (
                  <Button {...props} loading={busy} leftSection={<IconUpload size={16} />}>
                    Choose file
                  </Button>
                )}
              </FileButton>
              {parseError && (
                <Alert color="red" variant="light" icon={<IconAlertCircle size={14} />} w="100%">
                  {parseError}
                </Alert>
              )}
            </Stack>
          </Paper>
        </>
      )}

      {(stage === 'preview' || stage === 'applying' || stage === 'summary') && (
        <>
          {unknownColumns.length > 0 && (
            <Alert color="yellow" variant="light" icon={<IconAlertCircle size={14} />}>
              Ignored unknown column{unknownColumns.length === 1 ? '' : 's'}:{' '}
              <strong>{unknownColumns.join(', ')}</strong>. Only the whitelisted fields are
              applied.
            </Alert>
          )}

          <Paper p="md" radius="md" withBorder>
            <Group gap="md" mb="sm">
              <Badge size="lg" variant="light" color="green" leftSection={<IconCircleCheck size={14} />}>
                {validRows.length} valid
              </Badge>
              <Badge size="lg" variant="light" color="gray">
                {unchangedRows.length} unchanged
              </Badge>
              <Badge size="lg" variant="light" color="red" leftSection={<IconAlertCircle size={14} />}>
                {invalidRows.length} with errors
              </Badge>
              <Text size="sm" c="dimmed">
                {parsedRows.length} total row{parsedRows.length === 1 ? '' : 's'}
              </Text>
            </Group>

            {hasQuantityChange && (
              <Alert color="blue" variant="light" mb="sm" icon={<IconAlertCircle size={14} />}>
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Quantity changes detected — reason note required
                  </Text>
                  <Text size="xs" c="dimmed">
                    Each quantity change writes an audit-trail transaction with this reason.
                  </Text>
                  <TextInput
                    value={reason}
                    onChange={(e) => setReason(e.currentTarget.value)}
                    placeholder="e.g. cycle count, mass correction, stocktake"
                    maxLength={REASON_MAX}
                    disabled={stage !== 'preview'}
                    size="sm"
                  />
                </Stack>
              </Alert>
            )}

            {stage === 'applying' && (
              <Stack gap={4} mb="sm">
                <Text size="sm" fw={500}>
                  Applying changes — {progress.done} of {progress.total}
                </Text>
                <Progress
                  value={progress.total === 0 ? 0 : (progress.done / progress.total) * 100}
                  animated
                />
              </Stack>
            )}

            <ScrollArea h={500}>
              <Table withTableBorder withColumnBorders verticalSpacing="xs" stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>Row</Table.Th>
                    <Table.Th w={160}>Part Number</Table.Th>
                    <Table.Th miw={180}>Description</Table.Th>
                    <Table.Th miw={320}>Changes</Table.Th>
                    <Table.Th w={120}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {parsedRows.map((row) => (
                    <Table.Tr key={row.rowIndex}>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {row.rowIndex}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.partNumber || (
                            <span style={{ opacity: 0.5, fontStyle: 'italic' }}>(blank)</span>
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {row.current?.description1 || (
                            <span style={{ opacity: 0.5 }}>—</span>
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>{renderChanges(row)}</Table.Td>
                      <Table.Td>{renderRowStatus(row)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {stage === 'preview' && (
              <Group justify="flex-end" mt="md">
                <Button variant="subtle" onClick={resetAll}>
                  Cancel
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  disabled={validRows.length === 0}
                  onClick={handleApply}
                >
                  Apply {validRows.length} change{validRows.length === 1 ? '' : 's'}
                </Button>
              </Group>
            )}
          </Paper>
        </>
      )}

      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title="Confirm mass update"
        size="md"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            About to update <strong>{validRows.length}</strong> inventory item
            {validRows.length === 1 ? '' : 's'}. This action cannot be undone in bulk — failed
            rows will remain on screen so you can fix and re-apply.
          </Text>
          <List size="sm" spacing={4}>
            {hasQuantityChange && (
              <List.Item>
                Quantity changes will write an audit transaction with reason{' '}
                <em>&quot;{reason.trim()}&quot;</em>.
              </List.Item>
            )}
            <List.Item>
              {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} with errors will be
              skipped.
            </List.Item>
            <List.Item>
              {unchangedRows.length} row{unchangedRows.length === 1 ? '' : 's'} with no field
              differences will be skipped.
            </List.Item>
          </List>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeConfirm}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} leftSection={<IconCheck size={16} />}>
              Confirm and Apply
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={summaryOpened}
        onClose={closeSummary}
        title="Mass Update Summary"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group>
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
              {okCount} updated
            </Badge>
            {failCount > 0 && (
              <Badge color="red" variant="light" size="lg" leftSection={<IconAlertCircle size={14} />}>
                {failCount} failed
              </Badge>
            )}
          </Group>

          {failCount > 0 && (
            <>
              <Divider label="Failed rows" labelPosition="left" />
              <ScrollArea.Autosize mah={240}>
                <Stack gap="xs">
                  {outcomes
                    .filter((o) => !o.ok)
                    .map((o, i) => (
                      <Alert
                        key={`${o.partNumber}-${i}`}
                        color="red"
                        variant="light"
                        icon={<IconAlertCircle size={14} />}
                        title={o.partNumber || '(blank)'}
                      >
                        {o.error || 'Unknown error'}
                      </Alert>
                    ))}
                </Stack>
              </ScrollArea.Autosize>
              <Group>
                <Button
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => downloadErrorReport(parsedRows)}
                >
                  Download error report (CSV)
                </Button>
              </Group>
            </>
          )}

          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeSummary}>
              Close
            </Button>
            <Button onClick={resetAll} leftSection={<IconRotateClockwise size={14} />}>
              Run another update
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
