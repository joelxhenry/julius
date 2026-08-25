import { useState, useCallback } from 'react';
import {
  Menu,
  Button,
  Modal,
  Stack,
  Group,
  Text,
  Checkbox,
  ScrollArea,
  Badge,
  Alert,
  type ButtonProps,
} from '@mantine/core';
import { IconListSearch, IconPrinter, IconEye, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useLookupTicket } from '../../hooks/useLookupTicket';
import { IpcChannel } from '../../../shared/types/ipc';
import type { LookupTicketItem } from '../../../shared/types/lookupTicket';

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  location: string | null;
  description: string | null;
  quantity: number;
  isActive: boolean;
  isBase: boolean;
}

interface InventoryLookupTicketButtonProps {
  inventoryId: number;
  parentSku: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}

/**
 * Lookup ticket launcher for an inventory product. Because location now lives on
 * each variant, printing prompts the user to select one or more variants; the
 * ticket then lists a line per selected variant with its own location.
 */
export function InventoryLookupTicketButton({
  inventoryId,
  parentSku,
  size = 'xs',
  variant = 'light',
}: InventoryLookupTicketButtonProps) {
  const { printLookupTicket, isPrinting } = useLookupTicket();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [outputMode, setOutputMode] = useState<'print' | 'preview'>('print');

  const openPicker = useCallback(async (mode: 'print' | 'preview') => {
    setOutputMode(mode);
    setPickerOpen(true);
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VARIANTS_BY_INVENTORY, { inventoryId });
      if (result.success && result.data) {
        const rows: Variant[] = result.data;
        setVariants(rows);
        // Default to all active variants selected.
        setSelected(rows.filter((v) => v.isActive).map((v) => v.variantSku));
      } else {
        setVariants([]);
        setSelected([]);
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to load variants',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  const handleConfirm = useCallback(() => {
    const chosen = variants.filter((v) => selected.includes(v.variantSku));
    if (chosen.length === 0) return;

    const items: LookupTicketItem[] = chosen.map((v) => ({
      sku: v.variantSku,
      description: v.variantName || v.description || v.variantSku,
      location: v.location || '',
      quantity: v.quantity,
    }));

    printLookupTicket({
      source: 'inventory',
      outputMode,
      items,
      sourceReference: `Item ${parentSku}`,
    });
    setPickerOpen(false);
  }, [variants, selected, outputMode, parentSku, printLookupTicket]);

  return (
    <>
      <Menu shadow="md" width={180}>
        <Menu.Target>
          <Button
            size={size}
            variant={variant}
            color="orange"
            leftSection={<IconListSearch size={14} />}
            loading={isPrinting}
          >
            Lookup Ticket
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconPrinter size={16} />} onClick={() => openPicker('print')}>
            Print
          </Menu.Item>
          <Menu.Item leftSection={<IconEye size={16} />} onClick={() => openPicker('preview')}>
            Preview
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Modal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select Variants for Lookup Ticket"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Choose which variants to include. Each prints a line with its own location.
          </Text>

          {!loading && variants.length === 0 && (
            <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
              No variants found for this item.
            </Alert>
          )}

          <Checkbox.Group value={selected} onChange={setSelected}>
            <ScrollArea.Autosize mah={340}>
              <Stack gap="xs" pr="xs">
                {variants.map((v) => (
                  <Checkbox
                    key={v.id}
                    value={v.variantSku}
                    label={
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={500}>{v.variantSku}</Text>
                        {v.isBase && (
                          <Badge size="xs" variant="light" color="gray">
                            Base
                          </Badge>
                        )}
                        {!v.isActive && (
                          <Badge size="xs" variant="light" color="red">
                            Inactive
                          </Badge>
                        )}
                        <Text size="sm" c="dimmed">
                          {v.location ? `Loc: ${v.location}` : 'No location'}
                        </Text>
                      </Group>
                    }
                  />
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Checkbox.Group>

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              loading={isPrinting}
              disabled={selected.length === 0}
              leftSection={outputMode === 'print' ? <IconPrinter size={16} /> : <IconEye size={16} />}
            >
              {outputMode === 'print' ? 'Print' : 'Preview'} ({selected.length})
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
