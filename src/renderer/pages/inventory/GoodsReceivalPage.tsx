import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Table,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  ActionIcon,
  Tooltip,
  Badge,
  Modal,
  Alert,
  ScrollArea,
  Switch,
  Loader,
  Popover,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconTruckDelivery,
  IconPlus,
  IconFileImport,
  IconClipboardCheck,
  IconPrinter,
  IconUserPlus,
  IconAdjustmentsHorizontal,
  IconEye,
  IconFileTypePdf,
} from '@tabler/icons-react';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import type {
  ImportParseResult,
  PostReceivalPayload,
  ReceivalLinePayload,
} from '../../../shared/types/receiving';
import type { PrintOutputMode } from '../../../shared/types/print';
import { NewPartModal } from './NewPartModal';
import { ProductDisplay } from '../../components/common';
import { NewSupplierModal } from '../../components/suppliers';
import {
  ReceivalImportReviewModal,
  type ImportedLine,
} from '../../components/inventory/ReceivalImportReviewModal';
import { useReceivingReferencePrint } from '../../hooks/useReceivingReferencePrint';

const REFERENCE_MAX = 50;
const CURRENCY = 'JA';

interface ActiveSupplier {
  id: number;
  company: string;
}

interface SearchResult {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  category: string | null;
  model: string | null;
  isVariant: boolean;
  isBase?: boolean;
  parentSku: string | null;
  variantName: string | null;
}

interface ReceivalRow {
  rowId: string;
  /** Part number shown to the user. */
  displaySku: string;
  /** Product SKU to post against (base-variant target). */
  productSku: string;
  /** Specific variant SKU when a non-base variant was chosen. */
  variantSku: string | null;
  /** True when the part must be created on post (import unknowns). */
  isNew: boolean;
  newDescription: string | null;
  description: string;
  currentQty: number | null;
  receivedQty: number;
  unitCost: number;
  applyNewPricing: boolean;
  markup: number | null;
  newPrice: number | null;
  newWholesale: number | null;
}

let rowIdCounter = 0;
const nextRowId = () => `rcv-${Date.now()}-${++rowIdCounter}`;

const round2 = (n: number) => Math.round(n * 100) / 100;
const priceFromMarkup = (cost: number, markup: number) => round2(cost * (1 + markup / 100));
const markupFromPrice = (cost: number, price: number) =>
  cost > 0 ? round2(((price - cost) / cost) * 100) : null;

const rowError = (row: ReceivalRow): string | null => {
  if (!Number.isFinite(row.receivedQty) || row.receivedQty <= 0) {
    return 'Received quantity must be greater than 0';
  }
  if (!Number.isFinite(row.unitCost) || row.unitCost < 0) {
    return 'Unit cost cannot be negative';
  }
  if (row.applyNewPricing) {
    if (row.newPrice != null && row.newPrice < 0) return 'New price cannot be negative';
    if (row.newWholesale != null && row.newWholesale < 0) return 'Wholesale cannot be negative';
  }
  return null;
};

export function GoodsReceivalPage({ onBack }: { onBack?: () => void } = {}) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate('/inventory/manage'));
  const { printReceivingReference, isPrinting } = useReceivingReferencePrint();

  // Session header
  const [suppliers, setSuppliers] = useState<ActiveSupplier[]>([]);
  const [supplierLoading, setSupplierLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [receivingDate, setReceivingDate] = useState<Date>(() => new Date());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Lines
  const [rows, setRows] = useState<ReceivalRow[]>([]);

  // Add-item search
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOptions, setSearchOptions] = useState<SearchResult[]>([]);
  const resultsMapRef = useRef<Map<string, SearchResult>>(new Map());
  const [pickerKey, setPickerKey] = useState(0);

  // Keyboard focus flow: search input + newly-added row's qty input.
  const searchRef = useRef<HTMLInputElement>(null);
  const focusRowIdRef = useRef<string | null>(null);
  const focusSearch = useCallback(() => {
    // Remount bumps pickerKey; focus after the input re-renders.
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // Modals
  const [newPartOpened, { open: openNewPart, close: closeNewPart }] = useDisclosure(false);
  const [newSupplierOpened, { open: openNewSupplier, close: closeNewSupplier }] =
    useDisclosure(false);
  const [reviewOpened, { open: openReview, close: closeReview }] = useDisclosure(false);
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const [summaryOpened, { open: openSummary, close: closeSummary }] = useDisclosure(false);

  const [importResult, setImportResult] = useState<ImportParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postedReference, setPostedReference] = useState<string | null>(null);
  const [postedCount, setPostedCount] = useState(0);
  const [printMode, setPrintMode] = useState<PrintOutputMode | null>(null);

  const handlePrint = async (mode: PrintOutputMode) => {
    if (!postedReference) return;
    setPrintMode(mode);
    try {
      await printReceivingReference(postedReference, mode);
    } finally {
      setPrintMode(null);
    }
  };

  const handleDone = () => {
    closeSummary();
    handleBack();
  };

  const loadSuppliers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleSupplierCreated = async (supplier: { id: number; company: string }) => {
    await loadSuppliers();
    setSupplierId(supplier.id);
    focusSearch();
  };

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: String(s.id), label: s.company })),
    [suppliers]
  );
  const selectedSupplier = useMemo(
    () => (supplierId !== null ? suppliers.find((s) => s.id === supplierId) ?? null : null),
    [suppliers, supplierId]
  );
  const sessionReady = selectedSupplier !== null;

  // Keyboard flow: once a supplier is chosen, drop the cursor into the search box.
  useEffect(() => {
    if (sessionReady) focusSearch();
  }, [sessionReady, focusSearch]);

  // ----- Add-item search (products + variants, includes current cost) -----
  const runSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchOptions([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_INVENTORY_WITH_VARIANTS, {
        query,
        limit: 15,
      });
      if (result.success && Array.isArray(result.data)) {
        resultsMapRef.current.clear();
        (result.data as SearchResult[]).forEach((r) => resultsMapRef.current.set(r.sku, r));
        setSearchOptions(result.data as SearchResult[]);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  }, []);
  const debouncedSearch = useDebouncedCallback(runSearch, 400);

  const addRowFromResult = (item: SearchResult): boolean => {
    const isBase = !!item.isBase;
    const productSku = item.parentSku ?? item.sku;
    const variantSku = isBase ? null : item.sku;
    const displaySku = isBase ? productSku : item.sku;

    let added = false;
    setRows((prev) => {
      if (prev.some((r) => r.displaySku === displaySku)) {
        notifications.show({
          title: 'Already added',
          message: `${displaySku} is already on this receival.`,
          color: 'yellow',
          icon: <IconAlertCircle size={16} />,
        });
        return prev;
      }
      const cost = parseFloat(item.cost || '0') || 0;
      const row: ReceivalRow = {
        rowId: nextRowId(),
        displaySku,
        productSku,
        variantSku,
        isNew: false,
        newDescription: null,
        description: item.description1 || item.description2 || '',
        currentQty: item.quantity,
        receivedQty: 1,
        unitCost: cost,
        applyNewPricing: false,
        markup: null,
        newPrice: null,
        newWholesale: null,
      };
      focusRowIdRef.current = row.rowId; // focus its qty input on next render
      added = true;
      return [...prev, row];
    });
    return added;
  };

  const handlePick = (value: string | null) => {
    if (!value) return;
    const item = resultsMapRef.current.get(value);
    if (item) addRowFromResult(item);
    setSearchValue('');
    setSearchOptions([]);
    setPickerKey((k) => k + 1);
  };

  const removeRow = (rowId: string) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  const clearAll = () => setRows([]);

  const updateRow = <K extends keyof ReceivalRow>(rowId: string, field: K, value: ReceivalRow[K]) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row))
    );
  };

  // Cost change → recompute new price when markup is set and pricing applies.
  const setUnitCost = (rowId: string, cost: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, unitCost: cost };
        if (next.applyNewPricing && next.markup != null) {
          next.newPrice = priceFromMarkup(cost, next.markup);
        }
        return next;
      })
    );
  };
  const setMarkup = (rowId: string, markup: number | null) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, markup };
        if (markup != null) next.newPrice = priceFromMarkup(next.unitCost, markup);
        return next;
      })
    );
  };
  const setNewPrice = (rowId: string, price: number | null) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, newPrice: price };
        next.markup = price != null ? markupFromPrice(next.unitCost, price) : next.markup;
        return next;
      })
    );
  };
  const toggleApplyPricing = (rowId: string, on: boolean) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, applyNewPricing: on };
        if (on && next.newPrice == null && next.markup == null) {
          // Seed markup from current cost→price is unknown here; leave blank for the user.
        }
        return next;
      })
    );
  };

  // ----- Inline create (manual) -----
  const handlePartCreated = async (item: { id?: number; sku: string }) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, {
        sku: item.sku,
      });
      const data = result.success ? result.data : null;
      const cost = data ? parseFloat(data.cost || '0') || 0 : 0;
      setRows((prev) => {
        if (prev.some((r) => r.displaySku === item.sku)) return prev;
        return [
          ...prev,
          {
            rowId: nextRowId(),
            displaySku: item.sku,
            productSku: item.sku,
            variantSku: null,
            isNew: false,
            newDescription: null,
            description: data?.description1 || '',
            currentQty: data?.quantity ?? 0,
            receivedQty: 1,
            unitCost: cost,
            applyNewPricing: false,
            markup: null,
            newPrice: null,
            newWholesale: null,
          },
        ];
      });
    } catch (err) {
      console.error('Failed to load created part:', err);
    }
  };

  // ----- Import -----
  const handleImportClick = async () => {
    setImporting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.PARSE_RECEIVAL_IMPORT);
      if (!result.success) {
        notifications.show({
          title: 'Import failed',
          message: result.error || 'Could not read the file.',
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
        return;
      }
      if (result.data?.cancelled) return;
      setImportResult(result.data as ImportParseResult);
      openImport();
    } catch (err) {
      notifications.show({
        title: 'Import failed',
        message: err instanceof Error ? err.message : 'Unexpected error',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = async (lines: ImportedLine[]) => {
    closeImport();
    // Hydrate matched (existing) rows with current qty; new rows post with create.
    const existing = new Set(rows.map((r) => r.displaySku));
    const additions: ReceivalRow[] = [];
    let skipped = 0;

    for (const line of lines) {
      if (existing.has(line.sku)) {
        skipped++;
        continue;
      }
      existing.add(line.sku);

      let currentQty: number | null = null;
      let description = line.description || '';
      if (!line.isNew) {
        try {
          const res = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, {
            sku: line.sku,
          });
          if (res.success && res.data) {
            currentQty = res.data.quantity ?? 0;
            if (!description) description = res.data.description1 || '';
          }
        } catch {
          /* leave currentQty null */
        }
      }

      const applyPricing = line.newPrice != null || line.newWholesale != null;
      additions.push({
        rowId: nextRowId(),
        displaySku: line.sku,
        productSku: line.sku,
        variantSku: null,
        isNew: line.isNew,
        newDescription: line.isNew ? line.description : null,
        description,
        currentQty,
        receivedQty: line.quantity,
        unitCost: line.unitCost,
        applyNewPricing: applyPricing,
        markup: line.markup,
        newPrice: line.newPrice,
        newWholesale: line.newWholesale,
      });
    }

    setRows((prev) => [...prev, ...additions]);
    notifications.show({
      title: 'Import added',
      message: `${additions.length} row${additions.length === 1 ? '' : 's'} added${
        skipped ? `, ${skipped} skipped (already on receival)` : ''
      }.`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  };

  // ----- Validation / post -----
  const invalidRows = useMemo(() => rows.filter((r) => rowError(r) !== null), [rows]);
  const canReview = sessionReady && rows.length > 0 && invalidRows.length === 0;

  const buildPayload = (): PostReceivalPayload => {
    const lines: ReceivalLinePayload[] = rows.map((row) => ({
      sku: row.isNew || row.variantSku ? undefined : row.productSku,
      variantSku: row.variantSku ?? undefined,
      newPart: row.isNew
        ? { sku: row.productSku, description1: row.newDescription ?? row.description ?? null }
        : undefined,
      quantity: row.receivedQty,
      unitCost: row.unitCost,
      costCurrency: CURRENCY,
      applyNewPricing: row.applyNewPricing,
      newPrice: row.applyNewPricing ? row.newPrice : undefined,
      priceCurrency: CURRENCY,
      newWholesale: row.applyNewPricing ? row.newWholesale : undefined,
      margin: row.applyNewPricing ? row.markup : undefined,
    }));

    return {
      header: {
        supplierId,
        supplier: selectedSupplier?.company ?? null,
        receivingDate: receivingDate.toISOString().split('T')[0],
        reference: reference.trim().slice(0, REFERENCE_MAX) || null,
        notes: notes.trim() || null,
      },
      lines,
    };
  };

  const handlePost = async () => {
    if (!canReview) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const result = await window.electron.invoke(IpcChannel.POST_GOODS_RECEIVAL, payload);
      if (!result.success) {
        notifications.show({
          title: 'Receival failed',
          message: result.error || 'Nothing was posted - please review and try again.',
          color: 'red',
          icon: <IconAlertCircle size={16} />,
          autoClose: 8000,
        });
        return;
      }
      closeReview();
      setPostedReference(payload.header.reference);
      setPostedCount(rows.length);
      openSummary();
      notifications.show({
        title: 'Receival posted',
        message: `${rows.length} item${rows.length === 1 ? '' : 's'} received from ${
          selectedSupplier?.company
        }.`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
    } catch (err) {
      notifications.show({
        title: 'Receival failed',
        message: err instanceof Error ? err.message : 'Unexpected error',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const startAnother = () => {
    setRows([]);
    setReference('');
    setNotes('');
    setPostedReference(null);
    setPostedCount(0);
    closeSummary();
  };

  const totalUnits = useMemo(() => rows.reduce((sum, r) => sum + (r.receivedQty || 0), 0), [rows]);
  const totalCost = useMemo(
    () => rows.reduce((sum, r) => sum + (r.receivedQty || 0) * (r.unitCost || 0), 0),
    [rows]
  );

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <IconTruckDelivery size={24} />
            <Title order={2}>Receive Parts</Title>
          </Group>
          <Text c="dimmed" size="sm">
            Record a supplier receival against a reference. Search and press Enter to add a part,
            type the quantity, then Enter again to jump back to search. Create parts or suppliers
            inline, import from a spreadsheet, then review and post the whole receival at once.
          </Text>
        </Stack>
        <Button variant="subtle" onClick={handleBack}>
          Back
        </Button>
      </Group>

      {/* Session header */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Text fw={500} size="sm">
            Receival details
          </Text>
          <Group grow align="flex-end">
            <Select
              label="Supplier"
              placeholder={supplierLoading ? 'Loading suppliers…' : 'Choose a supplier'}
              data={supplierOptions}
              value={supplierId !== null ? String(supplierId) : null}
              onChange={(v) => setSupplierId(v ? Number(v) : null)}
              required
              searchable
              disabled={supplierLoading || submitting}
              nothingFoundMessage="No active suppliers"
              rightSectionPointerEvents="all"
              rightSection={
                <Tooltip label="New supplier" withArrow>
                  <ActionIcon
                    variant="subtle"
                    onClick={openNewSupplier}
                    disabled={submitting}
                    aria-label="Add new supplier"
                  >
                    <IconUserPlus size={16} />
                  </ActionIcon>
                </Tooltip>
              }
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
              placeholder="Optional but recommended"
              maxLength={REFERENCE_MAX}
              disabled={submitting}
            />
          </Group>
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            placeholder="Optional notes for this receival"
            autosize
            minRows={1}
            maxRows={3}
            disabled={submitting}
          />
        </Stack>
      </Paper>

      {/* Add items */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500} size="sm">
              Add items
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={openNewPart}
                disabled={!sessionReady || submitting}
              >
                New part
              </Button>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFileImport size={14} />}
                onClick={handleImportClick}
                loading={importing}
                disabled={!sessionReady || submitting}
              >
                Import file
              </Button>
            </Group>
          </Group>
          <Select
            key={pickerKey}
            ref={searchRef}
            label="Search by part number or description"
            placeholder="Type at least 2 characters…"
            data={searchOptions.map((r) => ({
              value: r.sku,
              label: `${r.isBase ? r.parentSku ?? r.sku : r.sku} - ${
                r.description1 || r.description2 || 'No description'
              }`,
            }))}
            searchable
            searchValue={searchValue}
            onSearchChange={(q) => {
              setSearchValue(q);
              debouncedSearch(q);
            }}
            value={null}
            onChange={handlePick}
            renderOption={({ option }) => {
              const item = resultsMapRef.current.get(option.value);
              if (!item) return <Text size="sm">{option.label}</Text>;
              const displaySku = item.isBase ? item.parentSku ?? item.sku : item.sku;
              return (
                <Stack gap={2} w="100%">
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <ProductDisplay
                      product={{
                        sku: displaySku,
                        category: item.category,
                        model: item.model,
                        price: item.price,
                      }}
                      size="xs"
                      showCopyButton={false}
                    />
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      Qty: {item.quantity}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {item.description1 || item.description2 || 'No description'}
                  </Text>
                </Stack>
              );
            }}
            nothingFoundMessage={
              searchLoading ? 'Searching…' : searchValue.length < 2 ? 'Type at least 2 characters' : 'No items found'
            }
            rightSection={searchLoading ? <Loader size="xs" /> : undefined}
            disabled={!sessionReady || submitting}
            maxDropdownHeight={320}
          />
          {!sessionReady && (
            <Text size="xs" c="dimmed">
              Select a supplier above to start adding items.
            </Text>
          )}
        </Stack>
      </Paper>

      {/* Lines */}
      <Paper p="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="md">
            <Text fw={500} size="sm">
              {rows.length} line{rows.length === 1 ? '' : 's'}
            </Text>
            {rows.length > 0 && (
              <Text size="sm" c="dimmed">
                {totalUnits} unit{totalUnits === 1 ? '' : 's'} · cost ${totalCost.toFixed(2)}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Button
              size="sm"
              variant="subtle"
              color="red"
              onClick={clearAll}
              disabled={submitting || rows.length === 0}
            >
              Clear all
            </Button>
            <Button
              leftSection={<IconClipboardCheck size={16} />}
              onClick={openReview}
              disabled={!canReview || submitting}
            >
              Review &amp; Post
            </Button>
          </Group>
        </Group>

        {rows.length === 0 ? (
          <Text c="dimmed" fs="italic" ta="center" py="xl">
            No items yet. Search above, add a new part, or import a file.
          </Text>
        ) : (
          <ScrollArea>
            <Table withTableBorder verticalSpacing="sm" miw={760}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={170}>Part #</Table.Th>
                  <Table.Th miw={200}>Description</Table.Th>
                  <Table.Th w={120}>Current</Table.Th>
                  <Table.Th w={110}>Received</Table.Th>
                  <Table.Th w={130}>Unit Cost</Table.Th>
                  <Table.Th w={160}>Pricing</Table.Th>
                  <Table.Th w={44} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => {
                  const err = rowError(row);
                  const pricingOff = !row.applyNewPricing;
                  return (
                    <Table.Tr key={row.rowId}>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Text size="sm" fw={500}>
                            {row.displaySku}
                          </Text>
                          {row.isNew && (
                            <Badge size="xs" color="yellow" variant="light">
                              new
                            </Badge>
                          )}
                          {row.variantSku && (
                            <Badge size="xs" color="blue" variant="light">
                              variant
                            </Badge>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={2}>
                          {row.description || <span style={{ opacity: 0.5 }}>-</span>}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {row.currentQty == null ? '-' : row.currentQty}
                          {row.currentQty != null && row.receivedQty > 0 && (
                            <Text component="span" size="xs" c="green">
                              {' '}
                              → {row.currentQty + row.receivedQty}
                            </Text>
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          ref={(el: HTMLInputElement | null) => {
                            if (el && focusRowIdRef.current === row.rowId) {
                              el.focus();
                              el.select();
                              focusRowIdRef.current = null;
                            }
                          }}
                          value={row.receivedQty}
                          onChange={(v) =>
                            updateRow(row.rowId, 'receivedQty', typeof v === 'number' ? v : 0)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusSearch();
                            }
                          }}
                          min={1}
                          size="xs"
                          hideControls
                          error={!Number.isFinite(row.receivedQty) || row.receivedQty <= 0}
                          disabled={submitting}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          value={row.unitCost}
                          onChange={(v) => setUnitCost(row.rowId, typeof v === 'number' ? v : 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              focusSearch();
                            }
                          }}
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          prefix="$"
                          size="xs"
                          hideControls
                          error={row.unitCost < 0}
                          disabled={submitting}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Popover width={280} position="bottom-end" withArrow shadow="md">
                          <Popover.Target>
                            <Button
                              variant={row.applyNewPricing ? 'light' : 'subtle'}
                              color={row.applyNewPricing ? 'blue' : 'gray'}
                              size="xs"
                              leftSection={<IconAdjustmentsHorizontal size={14} />}
                              disabled={submitting}
                              fullWidth
                              justify="flex-start"
                            >
                              {row.applyNewPricing
                                ? row.newPrice != null
                                  ? `New $${row.newPrice.toFixed(2)}`
                                  : 'Override'
                                : 'Cost only'}
                            </Button>
                          </Popover.Target>
                          <Popover.Dropdown>
                            <Stack gap="sm">
                              <Switch
                                label="Override selling price"
                                checked={row.applyNewPricing}
                                onChange={(e) =>
                                  toggleApplyPricing(row.rowId, e.currentTarget.checked)
                                }
                                size="sm"
                                disabled={submitting}
                              />
                              <NumberInput
                                label="Markup %"
                                value={row.markup ?? ''}
                                onChange={(v) =>
                                  setMarkup(row.rowId, typeof v === 'number' ? v : null)
                                }
                                suffix="%"
                                size="xs"
                                disabled={pricingOff || submitting}
                              />
                              <NumberInput
                                label="New unit price"
                                value={row.newPrice ?? ''}
                                onChange={(v) =>
                                  setNewPrice(row.rowId, typeof v === 'number' ? v : null)
                                }
                                min={0}
                                decimalScale={2}
                                fixedDecimalScale
                                prefix="$"
                                size="xs"
                                disabled={pricingOff || submitting}
                              />
                              <NumberInput
                                label="New wholesale"
                                value={row.newWholesale ?? ''}
                                onChange={(v) =>
                                  updateRow(
                                    row.rowId,
                                    'newWholesale',
                                    typeof v === 'number' ? v : null
                                  )
                                }
                                min={0}
                                decimalScale={2}
                                fixedDecimalScale
                                prefix="$"
                                size="xs"
                                disabled={pricingOff || submitting}
                              />
                              <Text size="xs" c="dimmed">
                                Off = update last cost only. On = also override selling/wholesale
                                price everywhere.
                              </Text>
                            </Stack>
                          </Popover.Dropdown>
                        </Popover>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={2} wrap="nowrap">
                          {err && (
                            <Tooltip label={err} withArrow>
                              <IconAlertCircle size={16} color="var(--mantine-color-red-6)" />
                            </Tooltip>
                          )}
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => removeRow(row.rowId)}
                            disabled={submitting}
                            aria-label="Remove row"
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
        {rows.length > 0 && invalidRows.length > 0 && (
          <Text size="xs" c="red" mt="xs">
            {invalidRows.length} line{invalidRows.length === 1 ? '' : 's'} need attention before you
            can post.
          </Text>
        )}
      </Paper>

      {/* Inline create */}
      <NewPartModal opened={newPartOpened} onClose={closeNewPart} onCreated={handlePartCreated} />
      <NewSupplierModal
        opened={newSupplierOpened}
        onClose={closeNewSupplier}
        onCreated={handleSupplierCreated}
      />

      {/* Import review */}
      <ReceivalImportReviewModal
        opened={importOpened}
        onClose={closeImport}
        result={importResult}
        onConfirm={handleImportConfirm}
      />

      {/* Review & post */}
      <Modal opened={reviewOpened} onClose={closeReview} title="Review receival" size="xl" centered>
        <Stack gap="md">
          <Group gap="xl">
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Supplier
              </Text>
              <Text size="sm" fw={500}>
                {selectedSupplier?.company}
              </Text>
            </Stack>
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                Date
              </Text>
              <Text size="sm" fw={500}>
                {receivingDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </Stack>
            {reference.trim() && (
              <Stack gap={0}>
                <Text size="xs" c="dimmed">
                  Reference
                </Text>
                <Text size="sm" fw={500}>
                  {reference.trim().slice(0, REFERENCE_MAX)}
                </Text>
              </Stack>
            )}
          </Group>
          <Text size="sm">
            {rows.length} line{rows.length === 1 ? '' : 's'} · {totalUnits} units · total cost $
            {totalCost.toFixed(2)}. Stock and cost update for every line; selling/wholesale price
            updates only where &quot;New Pricing&quot; is on.
          </Text>
          <ScrollArea.Autosize mah={380}>
            <Table withTableBorder withColumnBorders verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Part #</Table.Th>
                  <Table.Th w={70}>Recv</Table.Th>
                  <Table.Th w={90}>Cost</Table.Th>
                  <Table.Th w={110}>Pricing</Table.Th>
                  <Table.Th w={90}>New Price</Table.Th>
                  <Table.Th w={90}>Wholesale</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.rowId}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {row.displaySku}
                        </Text>
                        {row.isNew && (
                          <Badge size="xs" color="yellow" variant="light">
                            new
                          </Badge>
                        )}
                      </Group>
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
                      {row.applyNewPricing ? (
                        <Badge size="sm" color="blue" variant="light">
                          Override
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">
                          Cost only
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {row.applyNewPricing && row.newPrice != null
                          ? `$${row.newPrice.toFixed(2)}`
                          : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {row.applyNewPricing && row.newWholesale != null
                          ? `$${row.newWholesale.toFixed(2)}`
                          : '-'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeReview} disabled={submitting}>
              Keep editing
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handlePost}
              loading={submitting}
            >
              Post receival
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Summary */}
      <Modal opened={summaryOpened} onClose={startAnother} title="Receival posted" size="md" centered>
        <Stack gap="md">
          <Alert color="green" variant="light" icon={<IconCheck size={16} />}>
            {postedCount} item{postedCount === 1 ? '' : 's'} received from{' '}
            {selectedSupplier?.company}
            {postedReference ? ` against ${postedReference}` : ''}.
          </Alert>
          {postedReference && (
            <>
              <Text size="sm" fw={500}>
                Receiving report
              </Text>
              <Group gap="xs">
                <Button
                  variant="default"
                  leftSection={<IconEye size={16} />}
                  loading={printMode === 'preview'}
                  disabled={isPrinting && printMode !== 'preview'}
                  onClick={() => handlePrint('preview')}
                >
                  Preview
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconFileTypePdf size={16} />}
                  loading={printMode === 'pdf'}
                  disabled={isPrinting && printMode !== 'pdf'}
                  onClick={() => handlePrint('pdf')}
                >
                  Save PDF
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconPrinter size={16} />}
                  loading={printMode === 'print'}
                  disabled={isPrinting && printMode !== 'print'}
                  onClick={() => handlePrint('print')}
                >
                  Print
                </Button>
              </Group>
            </>
          )}
          {!postedReference && (
            <Text size="xs" c="dimmed">
              Add a reference number to enable previewing or printing the receiving report.
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleDone}>
              Done
            </Button>
            <Button leftSection={<IconTruckDelivery size={16} />} onClick={startAnother}>
              Receive another
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
