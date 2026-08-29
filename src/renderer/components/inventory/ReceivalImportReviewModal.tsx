import { useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Table,
  ScrollArea,
  Button,
  Alert,
  Checkbox,
  Tooltip,
  Divider,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconPlus, IconFileImport } from '@tabler/icons-react';
import type { ImportParseResult, ParsedImportRow } from '../../../shared/types/receiving';

export interface ImportedLine {
  sku: string;
  description: string | null;
  quantity: number;
  unitCost: number;
  newPrice: number | null;
  newWholesale: number | null;
  markup: number | null;
  /** True when this part did not exist and should be created on post. */
  isNew: boolean;
}

interface ReceivalImportReviewModalProps {
  opened: boolean;
  onClose: () => void;
  result: ImportParseResult | null;
  /** Called with the rows the user accepted (matched + chosen unknowns). */
  onConfirm: (lines: ImportedLine[]) => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function ReceivalImportReviewModal({
  opened,
  onClose,
  result,
  onConfirm,
}: ReceivalImportReviewModalProps) {
  // Unknown rows the user has opted to create + receive. Keyed by rowNumber.
  const [createUnknown, setCreateUnknown] = useState<Set<number>>(new Set());

  const rows = useMemo(() => result?.rows ?? [], [result]);
  const matched = useMemo(() => rows.filter((r) => r.status === 'matched'), [rows]);
  const unknown = useMemo(() => rows.filter((r) => r.status === 'unknown'), [rows]);
  const errored = useMemo(() => rows.filter((r) => r.status === 'error'), [rows]);

  const toggleUnknown = (rowNumber: number) => {
    setCreateUnknown((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const allUnknownSelected = unknown.length > 0 && unknown.every((r) => createUnknown.has(r.rowNumber));
  const toggleAllUnknown = () => {
    if (allUnknownSelected) setCreateUnknown(new Set());
    else setCreateUnknown(new Set(unknown.map((r) => r.rowNumber)));
  };

  const acceptedCount = matched.length + unknown.filter((r) => createUnknown.has(r.rowNumber)).length;

  const handleConfirm = () => {
    const lines: ImportedLine[] = [];
    for (const r of matched) {
      lines.push(toLine(r, false));
    }
    for (const r of unknown) {
      if (createUnknown.has(r.rowNumber)) lines.push(toLine(r, true));
    }
    onConfirm(lines);
  };

  const renderRow = (r: ParsedImportRow, opts: { selectable?: boolean } = {}) => (
    <Table.Tr key={r.rowNumber}>
      {opts.selectable && (
        <Table.Td>
          <Checkbox
            checked={createUnknown.has(r.rowNumber)}
            onChange={() => toggleUnknown(r.rowNumber)}
            aria-label={`Create ${r.sku}`}
          />
        </Table.Td>
      )}
      <Table.Td>
        <Text size="sm" c="dimmed">
          {r.rowNumber}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500}>
          {r.sku || <span style={{ opacity: 0.5 }}>-</span>}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1}>
          {r.description || <span style={{ opacity: 0.5 }}>-</span>}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm">{r.status === 'error' ? '-' : r.quantity}</Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm">{r.status === 'error' ? '-' : money(r.unitCost)}</Text>
      </Table.Td>
      <Table.Td>
        {r.status === 'error' ? (
          <Tooltip label={r.errors.join('; ')} withArrow multiline w={240}>
            <Badge size="sm" color="red" variant="light" leftSection={<IconAlertCircle size={12} />}>
              Error
            </Badge>
          </Tooltip>
        ) : r.status === 'matched' ? (
          <Badge size="sm" color="green" variant="light" leftSection={<IconCheck size={12} />}>
            Matched
          </Badge>
        ) : (
          <Badge size="sm" color="yellow" variant="light" leftSection={<IconPlus size={12} />}>
            New part
          </Badge>
        )}
      </Table.Td>
    </Table.Tr>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconFileImport size={18} />
          <Text fw={600}>Review Import{result ? ` - ${result.fileName}` : ''}</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        <Group>
          <Badge color="green" variant="light" size="lg">
            {matched.length} matched
          </Badge>
          <Badge color="yellow" variant="light" size="lg">
            {unknown.length} new
          </Badge>
          {errored.length > 0 && (
            <Badge color="red" variant="light" size="lg">
              {errored.length} error{errored.length === 1 ? '' : 's'}
            </Badge>
          )}
        </Group>

        {rows.length === 0 && (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
            No usable rows were found. Ensure the file has a header row with columns such as
            &quot;Part Number&quot;, &quot;Quantity&quot; and &quot;Cost&quot;.
          </Alert>
        )}

        {matched.length > 0 && (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Existing parts ({matched.length})
            </Text>
            <ScrollArea.Autosize mah={200}>
              <Table withTableBorder withColumnBorders verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>Row</Table.Th>
                    <Table.Th>Part #</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th w={70} ta="right">
                      Qty
                    </Table.Th>
                    <Table.Th w={100} ta="right">
                      Cost
                    </Table.Th>
                    <Table.Th w={110}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{matched.map((r) => renderRow(r))}</Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Stack>
        )}

        {unknown.length > 0 && (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Parts not in the system ({unknown.length})
              </Text>
              <Checkbox
                label="Create all"
                checked={allUnknownSelected}
                onChange={toggleAllUnknown}
                size="sm"
              />
            </Group>
            <Text size="xs" c="dimmed">
              Tick the parts you want created and received. Unticked rows are ignored.
            </Text>
            <ScrollArea.Autosize mah={220}>
              <Table withTableBorder withColumnBorders verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={40} />
                    <Table.Th w={50}>Row</Table.Th>
                    <Table.Th>Part #</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th w={70} ta="right">
                      Qty
                    </Table.Th>
                    <Table.Th w={100} ta="right">
                      Cost
                    </Table.Th>
                    <Table.Th w={110}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{unknown.map((r) => renderRow(r, { selectable: true }))}</Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </Stack>
        )}

        {errored.length > 0 && (
          <>
            <Divider label="Skipped rows" labelPosition="left" />
            <ScrollArea.Autosize mah={140}>
              <Table withTableBorder withColumnBorders verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th w={50}>Row</Table.Th>
                    <Table.Th>Part #</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th w={70} ta="right">
                      Qty
                    </Table.Th>
                    <Table.Th w={100} ta="right">
                      Cost
                    </Table.Th>
                    <Table.Th w={110}>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>{errored.map((r) => renderRow(r))}</Table.Tbody>
              </Table>
            </ScrollArea.Autosize>
          </>
        )}

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {acceptedCount} row{acceptedCount === 1 ? '' : 's'} will be added to the receival.
          </Text>
          <Group>
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              disabled={acceptedCount === 0}
              onClick={handleConfirm}
            >
              Add {acceptedCount} to receival
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

function toLine(r: ParsedImportRow, isNew: boolean): ImportedLine {
  return {
    sku: r.sku,
    description: r.description,
    quantity: r.quantity,
    unitCost: r.unitCost,
    newPrice: r.newPrice,
    newWholesale: r.newWholesale,
    markup: r.markup,
    isNew,
  };
}
