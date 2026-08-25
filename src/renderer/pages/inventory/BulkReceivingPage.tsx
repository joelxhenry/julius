import { useEffect, useMemo, useState } from 'react';
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
  ActionIcon,
  Tooltip,
  Badge,
  Modal,
  Alert,
  ScrollArea,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconTrash,
  IconDeviceFloppy,
  IconCheck,
  IconAlertCircle,
  IconRotateClockwise,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import { InventorySelect } from '../../components/selects/InventorySelect';

type RowStatus = 'pending' | 'saving' | 'success' | 'error';

interface PickedItem {
  id: number;
  sku: string;
  description1: string | null;
  quantity: number;
  price: string;
}

interface ReceivingRow {
  rowId: string;
  inventoryId: number;
  partNumber: string;
  description: string;
  currentQty: number;
  receivedQty: number;
  unitCost: number;
  status: RowStatus;
  errorMessage?: string;
}

interface ActiveSupplier {
  id: number;
  company: string;
}

interface RowOutcome {
  partNumber: string;
  ok: boolean;
  receivedQty: number;
  newQty: number;
  error?: string;
}

const REFERENCE_MAX = 50;

let rowIdCounter = 0;
const nextRowId = () => `rcv-${Date.now()}-${++rowIdCounter}`;

const isRowReady = (row: ReceivingRow): boolean => {
  if (row.status === 'success') return false;
  if (!Number.isFinite(row.receivedQty) || row.receivedQty <= 0) return false;
  if (!Number.isFinite(row.unitCost) || row.unitCost < 0) return false;
  return true;
};

const rowError = (row: ReceivingRow): string | null => {
  if (!Number.isFinite(row.receivedQty) || row.receivedQty <= 0) {
    return 'Received quantity must be greater than 0';
  }
  if (!Number.isFinite(row.unitCost) || row.unitCost < 0) {
    return 'Unit cost cannot be negative';
  }
  return null;
};

export function BulkReceivingPage() {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<ActiveSupplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [receivingDate, setReceivingDate] = useState<Date>(() => new Date());
  const [reference, setReference] = useState('');

  const [rows, setRows] = useState<ReceivingRow[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);

  useEffect(() => {
    const loadSuppliers = async () => {
      setSupplierLoading(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ACTIVE_SUPPLIERS);
        if (result.success && Array.isArray(result.data)) {
          setSuppliers(
            result.data.map((s: { id: number; company: string }) => ({
              id: s.id,
              company: s.company,
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load suppliers:', err);
      } finally {
        setSupplierLoading(false);
      }
    };
    loadSuppliers();
  }, []);

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.id), label: s.company })),
    [suppliers]
  );

  const selectedSupplier = useMemo(
    () => (supplierId !== null ? suppliers.find((s) => s.id === supplierId) ?? null : null),
    [suppliers, supplierId]
  );

  const handlePickItem = (_value: string | null, picked?: PickedItem) => {
    if (!picked) return;
    setRows((prev) => {
      if (prev.some((r) => r.inventoryId === picked.id)) {
        notifications.show({
          title: 'Already in list',
          message: `${picked.sku} is already in the receiving list.`,
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
          receivedQty: 1,
          unitCost: 0,
          status: 'pending',
        },
      ];
    });
    setPickerKey((k) => k + 1);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const clearAll = () => {
    setRows([]);
    setOutcomes([]);
  };

  const updateRow = <K extends keyof ReceivingRow>(
    rowId: string,
    field: K,
    value: ReceivingRow[K]
  ) => {
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

  const sessionReady = supplierId !== null && selectedSupplier !== null;

  const handleApply = () => {
    if (!sessionReady) {
      notifications.show({
        title: 'Supplier required',
        message: 'Select a supplier before recording receipts.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    if (readyRows.length === 0) {
      notifications.show({
        title: 'Nothing to receive',
        message:
          'Each row needs a positive received quantity and a non-negative unit cost before it can be submitted.',
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
      return;
    }
    openConfirm();
  };

  const handleConfirm = async () => {
    if (!selectedSupplier || supplierId === null) return;
    closeConfirm();
    setSubmitting(true);

    const readyIds = new Set(readyRows.map((r) => r.rowId));
    setRows((prev) =>
      prev.map((row) =>
        readyIds.has(row.rowId) ? { ...row, status: 'saving' as const } : row
      )
    );

    const dateString = receivingDate.toISOString().split('T')[0];
    const trimmedReference = reference.trim().slice(0, REFERENCE_MAX) || null;

    const results: Record<string, { ok: boolean; error?: string; newQty?: number }> = {};
    const summaryOutcomes: RowOutcome[] = [];

    for (const row of readyRows) {
      const newQty = row.currentQty + row.receivedQty;

      try {
        const receivingResult = await window.electron.invoke(
          IpcChannel.CREATE_INVENTORY_RECEIVING,
          {
            sku: row.partNumber,
            supplierId,
            supplier: selectedSupplier.company,
            receivingDate: dateString,
            quantity: row.receivedQty,
            lastCost: row.unitCost.toFixed(2),
            lastCostCurrency: 'JA',
            reference: trimmedReference,
          }
        );

        if (!receivingResult.success) {
          const message = receivingResult.error || 'Failed to record receiving';
          results[row.rowId] = { ok: false, error: message };
          summaryOutcomes.push({
            partNumber: row.partNumber,
            ok: false,
            receivedQty: row.receivedQty,
            newQty: row.currentQty,
            error: message,
          });
          continue;
        }

        const stockResult = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY_STOCK, {
          id: row.inventoryId,
          quantity: newQty,
        });

        if (!stockResult.success) {
          const message = `Receipt recorded, but stock update failed: ${
            stockResult.error || 'unknown error'
          }`;
          results[row.rowId] = { ok: false, error: message, newQty: row.currentQty };
          summaryOutcomes.push({
            partNumber: row.partNumber,
            ok: false,
            receivedQty: row.receivedQty,
            newQty: row.currentQty,
            error: message,
          });
          continue;
        }

        results[row.rowId] = { ok: true, newQty };
        summaryOutcomes.push({
          partNumber: row.partNumber,
          ok: true,
          receivedQty: row.receivedQty,
          newQty,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error';
        results[row.rowId] = { ok: false, error: message };
        summaryOutcomes.push({
          partNumber: row.partNumber,
          ok: false,
          receivedQty: row.receivedQty,
          newQty: row.currentQty,
          error: message,
        });
      }
    }

    setRows((prev) =>
      prev.map((row) => {
        const outcome = results[row.rowId];
        if (!outcome) return row;
        if (outcome.ok && typeof outcome.newQty === 'number') {
          return {
            ...row,
            status: 'success' as const,
            currentQty: outcome.newQty,
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
        title: 'Receiving Recorded',
        message: `${okCount} item${okCount === 1 ? '' : 's'} received from ${
          selectedSupplier.company
        }`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } else {
      notifications.show({
        title: 'Some Receipts Failed',
        message: `${okCount} recorded, ${failCount} failed. Failed rows remain on screen.`,
        color: 'yellow',
        icon: <IconAlertCircle size={16} />,
      });
    }
  };

  const handleSummaryClose = () => {
    setRows((prev) => prev.filter((r) => r.status !== 'success'));
    closeSummary();
  };

  const handleReceiveAnother = () => {
    setRows([]);
    setOutcomes([]);
    closeSummary();
  };

  const renderStatus = (row: ReceivingRow) => {
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
          Received
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
  const allSucceeded = outcomes.length > 0 && failCount === 0;

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Receive from Suppliers</Title>
          <Text c="dimmed" size="sm">
            Pick a supplier, capture session details, then add the items received. Each row
            creates a receiving record and increments on-hand stock.
          </Text>
        </Stack>
        <Button variant="subtle" onClick={() => navigate('/inventory/manage')}>
          Back
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <IconTruckDelivery size={18} />
            <Text fw={500} size="sm">
              Receiving session
            </Text>
          </Group>
          <Group grow align="flex-start">
            <Select
              label="Supplier"
              placeholder={supplierLoading ? 'Loading suppliers…' : 'Choose a supplier'}
              data={supplierOptions}
              value={supplierId !== null ? String(supplierId) : null}
              onChange={(v) => setSupplierId(v ? Number(v) : null)}
              required
              searchable
              disabled={supplierLoading || submitting || rows.some((r) => r.status === 'success')}
              nothingFoundMessage="No active suppliers"
            />
            <DateInput
              label="Received Date"
              value={receivingDate}
              onChange={(value) => value && setReceivingDate(value)}
              required
              disabled={submitting}
            />
            <TextInput
              label="Reference (PO / Invoice #)"
              value={reference}
              onChange={(e) => setReference(e.currentTarget.value)}
              placeholder="Optional"
              maxLength={REFERENCE_MAX}
              disabled={submitting}
            />
          </Group>
          {rows.some((r) => r.status === 'success') && (
            <Text size="xs" c="dimmed">
              Supplier locked while a session has saved rows. Click &quot;Receive Another&quot;
              in the summary to start a new session.
            </Text>
          )}
        </Stack>
      </Paper>

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
            disabled={!sessionReady || submitting}
          />
          {!sessionReady && (
            <Text size="xs" c="dimmed">
              Select a supplier above to start adding items.
            </Text>
          )}
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
              {rows.length} row{rows.length === 1 ? '' : 's'} • {readyRows.length} ready
            </Text>
          </Group>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            loading={submitting}
            onClick={handleApply}
            disabled={!sessionReady || readyRows.length === 0}
          >
            Submit Receiving
          </Button>
        </Group>

        {rows.length === 0 ? (
          <Text c="dimmed" fs="italic" ta="center" py="xl">
            No items added yet. Use the search above to add items received from this supplier.
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
                  <Table.Th w={120}>Received Qty</Table.Th>
                  <Table.Th w={130}>Unit Cost</Table.Th>
                  <Table.Th w={90}>New Qty</Table.Th>
                  <Table.Th w={110}>Status</Table.Th>
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row, index) => {
                  const disabled = row.status === 'saving' || row.status === 'success';
                  const newQty = row.currentQty + row.receivedQty;
                  const qtyError =
                    !Number.isFinite(row.receivedQty) || row.receivedQty <= 0;
                  const costError = !Number.isFinite(row.unitCost) || row.unitCost < 0;
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
                        <NumberInput
                          value={row.receivedQty}
                          onChange={(v) =>
                            updateRow(
                              row.rowId,
                              'receivedQty',
                              typeof v === 'number' ? v : 0
                            )
                          }
                          min={1}
                          disabled={disabled}
                          size="sm"
                          error={qtyError}
                          hideControls
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={row.unitCost}
                          onChange={(v) =>
                            updateRow(row.rowId, 'unitCost', typeof v === 'number' ? v : 0)
                          }
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          disabled={disabled}
                          size="sm"
                          error={costError}
                          prefix="$"
                          hideControls
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={500}>
                            {newQty}
                          </Text>
                          {row.receivedQty > 0 && !qtyError && (
                            <Text size="xs" c="green">
                              (+{row.receivedQty})
                            </Text>
                          )}
                        </Group>
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
        title="Confirm receiving"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Stack gap={2}>
            <Text size="sm">
              <Text component="span" fw={500}>
                Supplier:
              </Text>{' '}
              {selectedSupplier?.company}
            </Text>
            <Text size="sm">
              <Text component="span" fw={500}>
                Date:
              </Text>{' '}
              {receivingDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
            {reference.trim() && (
              <Text size="sm">
                <Text component="span" fw={500}>
                  Reference:
                </Text>{' '}
                {reference.trim().slice(0, REFERENCE_MAX)}
              </Text>
            )}
          </Stack>
          <Text size="sm">
            The following {readyRows.length} receipt{readyRows.length === 1 ? '' : 's'} will
            be recorded and on-hand stock will be incremented.
          </Text>
          <ScrollArea.Autosize mah={360}>
            <Table withTableBorder withColumnBorders verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th w={80}>Received</Table.Th>
                  <Table.Th w={100}>Unit Cost</Table.Th>
                  <Table.Th w={70}>From</Table.Th>
                  <Table.Th w={70}>To</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {readyRows.map((row) => {
                  const newQty = row.currentQty + row.receivedQty;
                  return (
                    <Table.Tr key={row.rowId}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.partNumber}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="green" fw={500}>
                          +{row.receivedQty}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">${row.unitCost.toFixed(2)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{row.currentQty}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {newQty}
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
              Confirm and Submit
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={summaryOpened}
        onClose={handleSummaryClose}
        title="Receiving Summary"
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group>
            <Badge color="green" variant="light" size="lg" leftSection={<IconCheck size={14} />}>
              {okCount} received
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
              <Divider label="Failed receipts" labelPosition="left" />
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
                Failed rows remain in the table — fix the issue and submit again.
              </Text>
            </>
          )}

          <Group justify="flex-end">
            {allSucceeded && (
              <Button
                variant="light"
                leftSection={<IconTruckDelivery size={16} />}
                onClick={handleReceiveAnother}
              >
                Receive Another Batch
              </Button>
            )}
            <Button onClick={handleSummaryClose}>Done</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
