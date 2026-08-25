import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Checkbox,
  Drawer,
  Group,
  NumberFormatter,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconBookmark,
  IconFileInvoice,
  IconFileText,
  IconPlaylistAdd,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { ProductThumbnail } from '../common/ProductThumbnail';
import {
  useMarkedItems,
  MarkedItem,
  DraftDocType,
} from '../../hooks/useMarkedItems';
import { useTabContext } from '../../contexts/TabContext';

interface MarkedItemsTrayProps {
  opened: boolean;
  onClose: () => void;
}

export function MarkedItemsTray({ opened, onClose }: MarkedItemsTrayProps) {
  const { items, count, unmark, setQuantity, clear, consumeKeys, draftHandler } = useMarkedItems();
  const navigate = useNavigate();
  const { openTab } = useTabContext();

  // Selection model: track which keys are EXcluded. New items default to selected
  // (i.e. not in the unselected set). The set may contain stale keys for items the
  // user has since unmarked — that's harmless because `selectedKeys` filters from
  // the current `items` list; stale entries can never appear in the result.
  const [unselectedKeys, setUnselectedKeys] = useState<Set<string>>(new Set());

  const selectedKeys = useMemo(
    () => items.map((i) => i.key).filter((k) => !unselectedKeys.has(k)),
    [items, unselectedKeys]
  );
  const selectedCount = selectedKeys.length;
  const allSelected = selectedCount === items.length && items.length > 0;
  const noneSelected = selectedCount === 0;

  const toggleKey = (key: string) => {
    setUnselectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setUnselectedKeys(allSelected ? new Set(items.map((i) => i.key)) : new Set());
  };

  const navigateToCreate = (path: string) => {
    navigate(path, { state: { fromTray: true, keys: selectedKeys } });
    onClose();
  };

  const handleAppendToCurrent = async () => {
    if (!draftHandler) return;
    if (selectedKeys.length === 0) return;
    const consumed = consumeKeys(selectedKeys);
    if (consumed.length === 0) return;
    await draftHandler.append(consumed);
    // Switch focus to the draft's tab so the user sees the items they just added.
    openTab(draftHandler.path);
    onClose();
  };

  const isCurrent = (docType: DraftDocType) => draftHandler?.docType === docType;

  const handleClearAll = () => {
    if (count === 0) return;
    modals.openConfirmModal({
      title: 'Clear marked items',
      children: (
        <Text size="sm">
          Remove all {count} marked item{count === 1 ? '' : 's'} from the tray? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Clear all', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        const cleared = count;
        clear();
        notifications.show({
          title: 'Tray cleared',
          message: `${cleared} item${cleared === 1 ? '' : 's'} removed from the tray.`,
          color: 'gray',
        });
      },
    });
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      padding={0}
      title={
        <Group gap="sm" wrap="nowrap">
          {count > 0 && (
            <Tooltip
              label={allSelected ? 'Deselect all' : 'Select all'}
              withArrow
              position="bottom"
            >
              <Checkbox
                aria-label="Select all marked items"
                checked={allSelected}
                indeterminate={!allSelected && selectedCount > 0}
                onChange={toggleAll}
              />
            </Tooltip>
          )}
          <Text fw={600}>
            Marked Items
            {count > 0 ? ` (${selectedCount === count ? count : `${selectedCount} of ${count}`})` : ''}
          </Text>
          {count > 0 && (
            <Tooltip label="Clear all" withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="red"
                aria-label="Clear all marked items"
                onClick={handleClearAll}
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      }
      styles={{
        header: {
          padding: 'var(--mantine-spacing-md)',
        },
        body: {
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100% - 60px)',
          padding: 0,
        },
      }}
    >
      <Box style={{ flex: 1, minHeight: 0, padding: 'var(--mantine-spacing-md)' }}>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea h="100%" type="auto" offsetScrollbars>
            <Stack gap="sm">
              {items.map((item) => (
                <TrayRow
                  key={item.key}
                  item={item}
                  selected={!unselectedKeys.has(item.key)}
                  onToggleSelected={() => toggleKey(item.key)}
                  onRemove={() => unmark(item.key)}
                  onQuantityChange={(qty) => setQuantity(item.key, qty)}
                />
              ))}
            </Stack>
          </ScrollArea>
        )}
      </Box>

      <Box
        style={{
          borderTop: '1px solid var(--mantine-color-default-border)',
          padding: 'var(--mantine-spacing-md)',
          background: 'var(--mantine-color-body)',
        }}
      >
        <Stack gap="xs">
          {draftHandler && (
            <Button
              leftSection={<IconPlaylistAdd size={16} />}
              variant="filled"
              color="blue"
              disabled={noneSelected}
              onClick={handleAppendToCurrent}
            >
              Add {selectedCount > 0 ? `${selectedCount} ` : ''}to {draftHandler.label}
            </Button>
          )}

          <Group grow gap="xs">
            <ActionLabel
              icon={<IconFileInvoice size={16} />}
              label={selectedCount > 0 && selectedCount !== count ? `New Invoice (${selectedCount})` : 'New Invoice'}
              disabled={noneSelected || isCurrent('invoice')}
              tooltip={
                isCurrent('invoice')
                  ? 'You are already on an invoice draft — use "Add to current invoice" above.'
                  : undefined
              }
              onClick={() => navigateToCreate('/invoices/form')}
            />
            <ActionLabel
              icon={<IconFileText size={16} />}
              label={selectedCount > 0 && selectedCount !== count ? `New Quotation (${selectedCount})` : 'New Quotation'}
              disabled={noneSelected || isCurrent('quotation')}
              tooltip={
                isCurrent('quotation')
                  ? 'You are already on a quotation draft — use "Add to current quotation" above.'
                  : undefined
              }
              onClick={() => navigateToCreate('/quotations/new')}
            />
          </Group>
        </Stack>
      </Box>
    </Drawer>
  );
}

interface ActionLabelProps {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  tooltip?: string;
  onClick: (() => void) | undefined;
}

function ActionLabel({ icon, label, disabled, tooltip, onClick }: ActionLabelProps) {
  const button = (
    <Button
      leftSection={icon}
      variant="default"
      size="sm"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip label={tooltip} withArrow position="top" multiline w={220}>
      <Box>{button}</Box>
    </Tooltip>
  );
}

function EmptyState() {
  return (
    <Center h="100%">
      <Stack align="center" gap="sm" maw={280} ta="center">
        <ThemeIcon variant="light" color="gray" size={64} radius="xl">
          <IconBookmark size={32} />
        </ThemeIcon>
        <Text fw={500}>No items marked yet</Text>
        <Text size="sm" c="dimmed">
          Mark items from the inventory list to get started.
        </Text>
      </Stack>
    </Center>
  );
}

interface TrayRowProps {
  item: MarkedItem;
  selected: boolean;
  onToggleSelected: () => void;
  onRemove: () => void;
  onQuantityChange: (qty: number) => void;
}

function TrayRow({ item, selected, onToggleSelected, onRemove, onQuantityChange }: TrayRowProps) {
  return (
    <Box
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-body)',
        opacity: selected ? 1 : 0.55,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Checkbox
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`${selected ? 'Deselect' : 'Select'} ${item.partNumber}`}
          mt={4}
        />
        <ProductThumbnail
          sku={item.partNumber}
          isVariant={item.isVariant}
          size={48}
          showTooltip={false}
        />
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} lineClamp={2}>
            {item.description || '(no description)'}
          </Text>
          <Group gap="xs" wrap="wrap">
            <Text size="xs" c="dimmed" ff="monospace">
              {item.partNumber}
            </Text>
            {item.isVariant && (
              <Badge size="xs" variant="light" color="grape">
                Variant
              </Badge>
            )}
            {item.isTaxable && (
              <Badge size="xs" variant="light" color="blue">
                Taxable
              </Badge>
            )}
          </Group>
          <Group gap="xs" justify="space-between" align="center">
            <NumberInput
              aria-label={`Quantity for ${item.partNumber}`}
              value={item.quantity}
              onChange={(value) => {
                const next = typeof value === 'number' ? value : parseInt(String(value), 10);
                if (Number.isFinite(next)) onQuantityChange(next);
              }}
              min={1}
              max={9999}
              step={1}
              size="xs"
              w={90}
              clampBehavior="strict"
              hideControls={false}
            />
            <Text size="sm" fw={500}>
              <NumberFormatter
                value={item.unitPrice}
                prefix="$"
                thousandSeparator
                decimalScale={2}
                fixedDecimalScale
              />
            </Text>
          </Group>
        </Stack>
        <ActionIcon
          variant="subtle"
          color="red"
          aria-label={`Remove ${item.partNumber} from tray`}
          onClick={onRemove}
        >
          <IconX size={16} />
        </ActionIcon>
      </Group>
    </Box>
  );
}
