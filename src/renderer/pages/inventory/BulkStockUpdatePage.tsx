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
  SegmentedControl,
  ActionIcon,
  Tooltip,
  Badge,
  Modal,
  Alert,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconTrash,
  IconDeviceFloppy,
  IconCheck,
  IconAlertCircle,
  IconRotateClockwise,
  IconArrowRight,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import { InventorySelect } from '../../components/selects/InventorySelect';

type AdjustMode = 'absolute' | 'delta';
type RowStatus = 'pending' | 'saving' | 'success' | 'error';

interface PickedItem {
  id: number;
  sku: string;
  description1: string | null;
  quantity: number;
}

interface AdjustRow {
  rowId: string;
  inventoryId: number;
  partNumber: string;
  description: string;
  currentQty: number;
  mode: AdjustMode;
  absoluteQty: number;
  delta: number;
  reason: string;
  status: RowStatus;
  errorMessage?: string;
}

interface RowOutcome {
  partNumber: string;
  ok: boolean;
  delta: number;
  newQty: number;
  error?: string;
}

const REASON_MAX = 50;

let rowIdCounter = 0;
const nextRowId = () => `adj-${Date.now()}-${++rowIdCounter}`;

const computeNewQty = (row: AdjustRow): number => {
  if (row.mode === 'absolute') return row.absoluteQty;
  return row.currentQty + row.delta;
};

const computeDelta = (row: AdjustRow): number => {
  return computeNewQty(row) - row.currentQty;
};

const isRowReady = (row: AdjustRow): boolean => {
  if (row.status === 'success') return false;
  if (!row.reason.trim()) return false;
  const newQty = computeNewQty(row);
  if (newQty < 0) return false;
  if (newQty === row.currentQty) return false;
  return true;
};

const rowError = (row: AdjustRow): string | null => {
  const newQty = computeNewQty(row);
  if (newQty < 0) return 'New quantity cannot be negative';
  if (newQty === row.currentQty) return 'No change in quantity';
  if (!row.reason.trim()) return 'Reason is required';
  return null;
};

export function BulkStockUpdatePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdjustRow[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);

  const handlePickItem = (_value: string | null, picked?: PickedItem) => {
    if (!picked) return;
    setRows((prev) => {
      if (prev.some((r) => r.inventoryId === picked.id)) {
        notifications.show({
          title: 'Already in list',
          message: `${picked.sku} is already in the working list.`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        return prev;
      }
      return [
        ...prev,
        {
          rowId: nextRowId(),
          inventoryId: picked.id,
          partNumber: picked.sku,
          description: picked.description1 || '',
          currentQty: picked.quantity,
          mode: 'absolute',
          absoluteQty: picked.quantity,
          delta: 0,
          reason: '',
          status: 'pending',
        },
      ];
    });
    // Reset the InventorySelect by remounting it so the user can pick again
    setPickerKey((k) => k + 1);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const clearAll = () => {
    setRows([]);
    setOutcomes([]);
  };

  const updateRow = <K extends keyof AdjustRow>(rowId: string, field: K, value: AdjustRow[K]) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const updated = { ...row, [field]: value };
        if (row.status === 'error') {
          updated.status = 'pending';
          updated.errorMessage = undefined;
        }
        return updated;
      })
    );
  };

  const readyRows = useMemo(() => rows.filter(isRowReady), [rows]);

  const handleApply = () => {
    if (readyRows.length === 0) {
      notifications.show({
        title: 'Nothing to apply',
        message:
          'Each row needs a non-zero change in quantity and a reason note before it can be applied.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    openConfirm();
  };

  const handleConfirm = async () => {
    closeConfirm();
    setSubmitting(true);

    // Mark ready rows as saving
    const readyIds = new Set(readyRows.map((r) => r.rowId));
    setRows((prev) =>
      prev.map((row) =>
        readyIds.has(row.rowId) ? { ...row, status: 'saving' as const } : row
      )
    );

    const results: Record<string, { ok: boolean; error?: string; newQty?: number }> = {};
    const summaryOutcomes: RowOutcome[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const row of readyRows) {
      const newQty = computeNewQty(row);
      const delta = newQty - row.currentQty;

      try {
        const stockResult = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY_STOCK, {
          id: row.inventoryId,
          quantity: newQty,
        });

        if (!stockResult.success) {
          const message = stockResult.error || 'Stock update failed';
          results[row.rowId] = { ok: false, error: message };
          summaryOutcomes.push({
            partNumber: row.partNumber,
            ok: false,
            delta,
            newQty,
            error: message,
          });
          continue;
        }

        const txResult = await window.electron.invoke(IpcChannel.CREATE_INVENTORY_TRANSACTION, {
          sku: row.partNumber,
          activity: 'ADJ',
          reference: row.reason.trim().slice(0, REASON_MAX),
          quantity: delta,
          activityDate: today,
        });

        if (!txResult.success) {
          const message = `Stock updated, but audit log failed: ${txResult.error || 'unknown error'}`;
          results[row.rowId] = { ok: false, error: message, newQty };
          summaryOutcomes.push({
            partNumber: row.partNumber,
            ok: false,
            delta,
            newQty,
            error: message,
          });
          continue;
        }

        results[row.rowId] = { ok: true, newQty };
        summaryOutcomes.push({ partNumber: row.partNumber, ok: true, delta, newQty });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        results[row.rowId] = { ok: false, error: message };
        summaryOutcomes.push({
          partNumber: row.partNumber,
          ok: false,
          delta,
          newQty,
          error: message,
        });
      }
    }

    // Apply outcomes back to row state — successful rows update to new currentQty
    setRows((prev) =>
      prev.map((row) => {
        const outcome = results[row.rowId];
        if (!outcome) return row;
        if (outcome.ok && typeof outcome.newQty === 'number') {
          return {
            ...row,
            status: 'success' as const,
            currentQty: outcome.newQty,
            absoluteQty: outcome.newQty,
            delta: 0,
            errorMessage: undefined,
          };
        }
        return { ...row, status: 'error' as const, errorMessage: outcome.error };
      })
    );

    setOutcomes(summaryOutcomes);
    setSubmitting(false);
    openSummary();

    const okCount = summaryOutcomes.filter((o) => o.ok).length;
    const failCount = summaryOutcomes.length - okCount;
    if (failCount === 0) {
      notifications.show({
        title: 'Stock Adjusted',
        message: `${okCount} item${okCount === 1 ? '' : 's'} updated successfully`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } else {
      notifications.show({
        title: 'Some Adjustments Failed',
        message: `${okCount} updated, ${failCount} failed. Failed rows remain on screen.`,
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleSummaryClose = () => {
    // Drop successful rows from the working set; keep failed/pending
    setRows((prev) => prev.filter((r) => r.status !== 'success'));
    closeSummary();
  };

  const renderStatus = (row: AdjustRow) => {
    if (row.status === 'saving') {
      return (
        <Badge size="sm" variant="light" color="blue">
          Saving…
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
    if (row.status === 'error') {
      return (
        <Tooltip label={row.errorMessage || 'Failed'} withArrow multiline w={240}>
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
    const err = rowError(row);
    if (err) {
      return (
        <Tooltip label={err} withArrow>
          <Badge size="sm" variant="light" color="gray">
            Incomplete
          </Badge>
        </Tooltip>
      );
    }
    return (
      <Badge size="sm" variant="light" color="gray">
        Ready
      </Badge>
    );
  };

  const okCount = outcomes.filter((o) => o.ok).length;
  const failCount = outcomes.length - okCount;

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Update Stock</Title>
          <Text c="dimmed" size="sm">
            Add items to the working list, set the new on-hand quantity (or apply a delta),
            and record a reason. Each adjustment writes an audit-trail transaction.
          </Text>
        </Stack>
        <Button variant="subtle" onClick={() => navigate('/inventory/manage')}>
          Back
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={500} size="sm">
            Add an item
          </Text>
          <InventorySelect
            key={pickerKey}
            value={null}
            onChange={handlePickItem as (value: string | null, item?: PickedItem) => void}
            label="Search by part number or description"
            placeholder="Type at least 2 characters…"
            clearable={false}
          />
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Button
              size="sm"
              variant="subtle"
              color="red"
              leftSection={<IconRotateClockwise size={14} />}
              onClick={clearAll}
              disabled={submitting || rows.length === 0}
            >
              Clear All
            </Button>
            <Text size="sm" c="dimmed">
              {rows.length} row{rows.length === 1 ? '' : 's'} in list • {readyRows.length} ready
            </Text>
          </Group>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            loading={submitting}
            onClick={handleApply}
            disabled={readyRows.length === 0}
          >
            Apply Changes
          </Button>
        </Group>

        {rows.length === 0 ? (
          <Text c="dimmed" fs="italic" ta="center" py="xl">
            No items in the working list yet. Use the search above to add items.
          </Text>
        ) : (
          <ScrollArea>
            <Table withTableBorder withColumnBorders verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>#</Table.Th>
                  <Table.Th w={160}>Part Number</Table.Th>
                  <Table.Th miw={200}>Description</Table.Th>
                  <Table.Th w={90}>Current</Table.Th>
                  <Table.Th w={170}>Mode</Table.Th>
                  <Table.Th w={130}>Value</Table.Th>
                  <Table.Th w={90}>New Qty</Table.Th>
                  <Table.Th miw={220}>Reason *</Table.Th>
                  <Table.Th w={110}>Status</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, index) => {
                  const disabled = row.status === 'saving' || row.status === 'success';
                  const newQty = computeNewQty(row);
                  const delta = computeDelta(row);
                  const newQtyError = newQty < 0;
                  return (
                    <Table.Tr key={row.rowId}>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {index + 1}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.partNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {row.description || <span style={{ opacity: 0.5 }}>—</span>}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{row.currentQty}</Text>
                      </Table.Td>
                      <Table.Td>
                        <SegmentedControl
                          size="xs"
                          value={row.mode}
                          onChange={(v) => updateRow(row.rowId, 'mode', v as AdjustMode)}
                          data={[
                            { label: 'Set', value: 'absolute' },
                            { label: 'Delta', value: 'delta' },
                          ]}
                          disabled={disabled}
                        />
                      </Table.Td>
                      <Table.Td>
                        {row.mode === 'absolute' ? (
                          <NumberInput
                            value={row.absoluteQty}
                            onChange={(v) =>
                              updateRow(
                                row.rowId,
                                'absoluteQty',
                                typeof v === 'number' ? v : 0
                              )
                            }
                            min={0}
                            disabled={disabled}
                            size="sm"
                            error={newQtyError}
                            hideControls
                          />
                        ) : (
                          <NumberInput
                            value={row.delta}
                            onChange={(v) =>
                              updateRow(row.rowId, 'delta', typeof v === 'number' ? v : 0)
                            }
                            disabled={disabled}
                            size="sm"
                            error={newQtyError}
                            placeholder="+5 or -2"
                            hideControls
                          />
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={500} c={newQtyError ? 'red' : undefined}>
                            {newQty}
                          </Text>
                          {delta !== 0 && !newQtyError && (
                            <Text
                              size="xs"
                              c={delta > 0 ? 'green' : 'red'}
                            >
                              ({delta > 0 ? '+' : ''}
                              {delta})
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.reason}
                          onChange={(e) =>
                            updateRow(row.rowId, 'reason', e.currentTarget.value)
                          }
                          placeholder="e.g. cycle count, damaged, shrinkage"
                          maxLength={REASON_MAX}
                          disabled={disabled}
                          size="sm"
                        />
                      </Table.Td>
                      <Table.Td>{renderStatus(row)}</Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => removeRow(row.rowId)}
                          disabled={disabled}
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
        )}
      </Paper>

      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title="Confirm stock adjustments"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            The following {readyRows.length} adjustment{readyRows.length === 1 ? '' : 's'}{' '}
            will be applied. Each writes an audit-trail transaction.
          </Text>
          <ScrollArea.Autosize mah={360}>
            <Table withTableBorder withColumnBorders verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th w={70}>From</Table.Th>
                  <Table.Th w={40} />
                  <Table.Th w={70}>To</Table.Th>
                  <Table.Th w={70}>Δ</Table.Th>
                  <Table.Th>Reason</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {readyRows.map((row) => {
                  const newQty = computeNewQty(row);
                  const delta = newQty - row.currentQty;
                  return (
                    <Table.Tr key={row.rowId}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.partNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{row.currentQty}</Text>
                      </Table.Td>
                      <Table.Td>
                        <IconArrowRight size={14} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {newQty}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={delta > 0 ? 'green' : 'red'}>
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {row.reason}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
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
        onClose={handleSummaryClose}
        title="Adjustment Summary"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group>
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
              {okCount} updated
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
              <Divider label="Failed adjustments" labelPosition="left" />
              <Stack gap="xs">
                {outcomes
                  .filter((o) => !o.ok)
                  .map((o, i) => (
                    <Alert
                      key={`${o.partNumber}-${i}`}
                      color="red"
                      variant="light"
                      icon={<IconAlertCircle size={14} />}
                      title={o.partNumber}
                    >
                      {o.error || 'Unknown error'}
                    </Alert>
                  ))}
              </Stack>
              <Text size="sm" c="dimmed">
                Failed rows remain in the table — fix the issue and apply again.
              </Text>
            </>
          )}

          <Group justify="flex-end">
            <Button onClick={handleSummaryClose}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
