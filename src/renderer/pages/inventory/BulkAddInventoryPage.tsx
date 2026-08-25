import { useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Table,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  ActionIcon,
  Tooltip,
  Badge,
  Modal,
  Alert,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconCheck,
  IconAlertCircle,
  IconRotateClockwise,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';

const UNIT_OPTIONS = [
  { value: 'EA', label: 'Each (EA)' },
  { value: 'BOX', label: 'Box' },
  { value: 'SET', label: 'Set' },
  { value: 'PR', label: 'Pair (PR)' },
  { value: 'LT', label: 'Liter (LT)' },
  { value: 'GAL', label: 'Gallon (GAL)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'LB', label: 'Pound (LB)' },
  { value: 'M', label: 'Meter (M)' },
  { value: 'FT', label: 'Feet (FT)' },
];

type RowStatus = 'pending' | 'creating' | 'success' | 'error';

interface BulkAddRow {
  id: string;
  sku: string;
  description1: string;
  quantity: number;
  minLevel: number;
  cost: number;
  price: number;
  location: string;
  unit: string;
  isTaxable: boolean;
  status: RowStatus;
  errorMessage?: string;
  fieldErrors: { sku?: string; description1?: string; cost?: string; price?: string };
}

interface RowOutcome {
  partNumber: string;
  ok: boolean;
  error?: string;
}

const DEFAULT_BLANK = {
  sku: '',
  description1: '',
  quantity: 0,
  minLevel: 0,
  cost: 0,
  price: 0,
  location: '',
  unit: 'EA',
  isTaxable: true,
};

let rowIdCounter = 0;
const nextRowId = () => `row-${Date.now()}-${++rowIdCounter}`;

const emptyRow = (): BulkAddRow => ({
  id: nextRowId(),
  ...DEFAULT_BLANK,
  status: 'pending',
  fieldErrors: {},
});

const validateRow = (row: BulkAddRow): BulkAddRow['fieldErrors'] => {
  const errors: BulkAddRow['fieldErrors'] = {};
  if (!row.sku.trim()) errors.sku = 'Part Number is required';
  if (!row.description1.trim()) errors.description1 = 'Description is required';
  if (row.cost < 0) errors.cost = 'Cost cannot be negative';
  if (row.price < 0) errors.price = 'Price cannot be negative';
  return errors;
};

export function BulkAddInventoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BulkAddRow[]>(() =>
    Array.from({ length: 3 }, () => emptyRow())
  );
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
  };

  const addFiveRows = () => {
    setRows((prev) => [...prev, ...Array.from({ length: 5 }, () => emptyRow())]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const clearAll = () => {
    setRows([emptyRow()]);
    setOutcomes([]);
  };

  const updateField = <K extends keyof BulkAddRow>(id: string, field: K, value: BulkAddRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        // Reset error state when user edits a row that previously failed
        if (row.status === 'error') {
          updated.status = 'pending';
          updated.errorMessage = undefined;
        }
        // Re-validate the field that changed
        const fieldErrors = validateRow(updated);
        updated.fieldErrors = fieldErrors;
        return updated;
      })
    );
  };

  const validRowCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.sku.trim() &&
          r.description1.trim() &&
          r.cost >= 0 &&
          r.price >= 0 &&
          r.status !== 'success'
      ).length,
    [rows]
  );

  const handleSaveAll = async () => {
    // Validate all rows up front; mark errors but only submit valid ones.
    const prepared = rows.map((row) => {
      if (row.status === 'success') return row;
      const fieldErrors = validateRow(row);
      return { ...row, fieldErrors };
    });

    const submittable = prepared.filter(
      (r) => r.status !== 'success' && Object.keys(r.fieldErrors).length === 0
    );

    if (submittable.length === 0) {
      setRows(prepared);
      notifications.show({
        title: 'Nothing to save',
        message: 'Fix validation errors or fill in at least one row before saving.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }

    // Mark submittable rows as "creating"
    setRows(
      prepared.map((row) =>
        submittable.some((s) => s.id === row.id) ? { ...row, status: 'creating' as const } : row
      )
    );

    setSubmitting(true);
    const results: Record<string, { ok: boolean; error?: string }> = {};
    const summaryOutcomes: RowOutcome[] = [];

    for (const row of submittable) {
      const payload = {
        sku: row.sku.trim(),
        description1: row.description1.trim() || null,
        description2: null,
        category: null,
        model: null,
        location: row.location.trim() || null,
        unit: row.unit,
        quantity: row.quantity,
        minLevel: row.minLevel,
        cost: row.cost.toString(),
        costCurrency: 'JA',
        price: row.price.toString(),
        priceCurrency: 'JA',
        wholesalePrice: null,
        margin: null,
        isTaxable: row.isTaxable,
      };

      try {
        const result = await window.electron.invoke(IpcChannel.CREATE_INVENTORY, payload);
        if (result.success) {
          results[row.id] = { ok: true };
          summaryOutcomes.push({ partNumber: row.sku.trim(), ok: true });
        } else {
          results[row.id] = { ok: false, error: result.error || 'Unknown error' };
          summaryOutcomes.push({ partNumber: row.sku.trim(), ok: false, error: result.error });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        results[row.id] = { ok: false, error: message };
        summaryOutcomes.push({ partNumber: row.sku.trim(), ok: false, error: message });
      }
    }

    // Apply outcomes back to row state
    setRows((prev) =>
      prev.map((row) => {
        const outcome = results[row.id];
        if (!outcome) return row;
        if (outcome.ok) {
          return { ...row, status: 'success', errorMessage: undefined };
        }
        return { ...row, status: 'error', errorMessage: outcome.error };
      })
    );

    setOutcomes(summaryOutcomes);
    setSubmitting(false);
    openSummary();

    const created = summaryOutcomes.filter((o) => o.ok).length;
    const failed = summaryOutcomes.length - created;
    if (failed === 0) {
      notifications.show({
        title: 'Items Created',
        message: `${created} inventory item${created === 1 ? '' : 's'} created successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } else {
      notifications.show({
        title: 'Some Items Failed',
        message: `${created} created, ${failed} failed. Failed rows remain on screen for correction.`,
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleSummaryClose = () => {
    // Drop successful rows from the working set; keep failed/pending on screen.
    setRows((prev) => {
      const remaining = prev.filter((r) => r.status !== 'success');
      return remaining.length > 0 ? remaining : [emptyRow()];
    });
    closeSummary();
  };

  const renderStatus = (row: BulkAddRow) => {
    if (row.status === 'creating') {
      return (
        <Badge size="sm" variant="light" color="blue">
          Saving…
        </Badge>
      );
    }
    if (row.status === 'success') {
      return (
        <Badge size="sm" variant="light" color="green" leftSection={<IconCheck size={12} />}>
          Created
        </Badge>
      );
    }
    if (row.status === 'error') {
      return (
        <Tooltip label={row.errorMessage || 'Failed to create'} withArrow multiline w={240}>
          <Badge
            size="sm"
            variant="light"
            color="red"
            leftSection={<IconAlertCircle size={12} />}
          >
            Failed
          </Badge>
        </Tooltip>
      );
    }
    return (
      <Badge size="sm" variant="light" color="gray">
        Pending
      </Badge>
    );
  };

  const successCount = outcomes.filter((o) => o.ok).length;
  const failCount = outcomes.length - successCount;

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Add Inventory</Title>
          <Text c="dimmed" size="sm">
            Spreadsheet-style entry. Enter one inventory item per row, then Save All to create
            them. Rows that fail will stay on screen with the error so you can fix and retry.
          </Text>
        </Stack>
        <Group>
          <Button variant="subtle" onClick={() => navigate('/inventory/manage')}>
            Back
          </Button>
        </Group>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Button
              size="sm"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={addRow}
            >
              Add Row
            </Button>
            <Button size="sm" variant="subtle" onClick={addFiveRows}>
              + 5 Rows
            </Button>
            <Button
              size="sm"
              variant="subtle"
              color="red"
              leftSection={<IconRotateClockwise size={14} />}
              onClick={clearAll}
              disabled={submitting}
            >
              Clear All
            </Button>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {validRowCount} row{validRowCount === 1 ? '' : 's'} ready
            </Text>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              loading={submitting}
              onClick={handleSaveAll}
              disabled={validRowCount === 0}
            >
              Save All
            </Button>
          </Group>
        </Group>

        <ScrollArea>
          <Table withTableBorder withColumnBorders verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>#</Table.Th>
                <Table.Th w={160}>Part Number *</Table.Th>
                <Table.Th miw={220}>Description *</Table.Th>
                <Table.Th w={110}>Quantity</Table.Th>
                <Table.Th w={110}>Min Level</Table.Th>
                <Table.Th w={130}>Cost</Table.Th>
                <Table.Th w={130}>Price</Table.Th>
                <Table.Th w={130}>Location</Table.Th>
                <Table.Th w={140}>Unit</Table.Th>
                <Table.Th w={90}>Taxable</Table.Th>
                <Table.Th w={110}>Status</Table.Th>
                <Table.Th w={50} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, index) => {
                const disabled = row.status === 'creating' || row.status === 'success';
                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {index + 1}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        value={row.sku}
                        onChange={(e) => updateField(row.id, 'sku', e.currentTarget.value)}
                        placeholder="e.g. ABC-123"
                        error={row.fieldErrors.sku}
                        disabled={disabled}
                        size="sm"
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        value={row.description1}
                        onChange={(e) =>
                          updateField(row.id, 'description1', e.currentTarget.value)
                        }
                        placeholder="Item description"
                        error={row.fieldErrors.description1}
                        disabled={disabled}
                        size="sm"
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={row.quantity}
                        onChange={(v) =>
                          updateField(row.id, 'quantity', typeof v === 'number' ? v : 0)
                        }
                        min={0}
                        disabled={disabled}
                        size="sm"
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={row.minLevel}
                        onChange={(v) =>
                          updateField(row.id, 'minLevel', typeof v === 'number' ? v : 0)
                        }
                        min={0}
                        disabled={disabled}
                        size="sm"
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={row.cost}
                        onChange={(v) =>
                          updateField(row.id, 'cost', typeof v === 'number' ? v : 0)
                        }
                        min={0}
                        decimalScale={2}
                        fixedDecimalScale
                        thousandSeparator
                        error={row.fieldErrors.cost}
                        disabled={disabled}
                        size="sm"
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <NumberInput
                        value={row.price}
                        onChange={(v) =>
                          updateField(row.id, 'price', typeof v === 'number' ? v : 0)
                        }
                        min={0}
                        decimalScale={2}
                        fixedDecimalScale
                        thousandSeparator
                        error={row.fieldErrors.price}
                        disabled={disabled}
                        size="sm"
                        hideControls
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        value={row.location}
                        onChange={(e) => updateField(row.id, 'location', e.currentTarget.value)}
                        placeholder="Warehouse"
                        disabled={disabled}
                        size="sm"
                      />
                    </Table.Td>
                    <Table.Td>
                      <Select
                        value={row.unit}
                        onChange={(v) => updateField(row.id, 'unit', v || 'EA')}
                        data={UNIT_OPTIONS}
                        disabled={disabled}
                        size="sm"
                        allowDeselect={false}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Checkbox
                        checked={row.isTaxable}
                        onChange={(e) =>
                          updateField(row.id, 'isTaxable', e.currentTarget.checked)
                        }
                        disabled={disabled}
                      />
                    </Table.Td>
                    <Table.Td>{renderStatus(row)}</Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => removeRow(row.id)}
                        disabled={disabled || rows.length <= 1}
                        aria-label="Remove row"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Modal
        opened={summaryOpened}
        onClose={handleSummaryClose}
        title="Save Summary"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group>
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
              {successCount} created
            </Badge>
            {failCount > 0 && (
              <Badge
                color="red"
                variant="light"
                size="lg"
                leftSection={<IconAlertCircle size={14} />}
              >
                {failCount} failed
              </Badge>
            )}
          </Group>

          {failCount > 0 && (
            <>
              <Divider label="Failed rows" labelPosition="left" />
              <Stack gap="xs">
                {outcomes
                  .filter((o) => !o.ok)
                  .map((o, i) => (
                    <Alert
                      key={`${o.partNumber}-${i}`}
                      color="red"
                      variant="light"
                      icon={<IconAlertCircle size={14} />}
                      title={o.partNumber || '(blank part number)'}
                    >
                      {o.error || 'Unknown error'}
                    </Alert>
                  ))}
              </Stack>
              <Text size="sm" c="dimmed">
                Failed rows remain in the table — fix the issue and click Save All again.
              </Text>
            </>
          )}

          <Group justify="flex-end">
            {successCount > 0 && failCount === 0 && (
              <Button
                variant="subtle"
                onClick={() => {
                  handleSummaryClose();
                  navigate('/inventory');
                }}
              >
                View Inventory List
              </Button>
            )}
            <Button onClick={handleSummaryClose}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
