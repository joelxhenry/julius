import React, { useRef, useEffect, RefObject } from 'react';
import {
  Stack,
  Text,
  Paper,
  Table,
  ActionIcon,
  Loader,
  Center,
  TextInput,
  NumberInput,
  Autocomplete,
  Badge,
  Group,
  Tooltip,
  Menu,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
  Box,
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertTriangle, IconReplace } from '@tabler/icons-react';
import { CopyButton } from '../common';
import type { InventoryWarning } from './InventoryWarningModal';
import type { LineItem } from '../../../shared/types/inventory';
import type { EditingCell, EditableField } from '../../hooks/useLineItems';

// Re-export LineItem for backwards compatibility
export type { LineItem };

interface InvoiceLineItemsTableProps {
  lineItems: LineItem[];
  itemSearch: string;
  setItemSearch: (value: string) => void;
  itemOptions: { value: string; label: string; item: unknown }[];
  isSearchingItems: boolean;
  onItemSearchChange: (value: string) => void;
  onItemSelect: (value: string) => void;
  onUpdateLineItem: (itemId: string, field: keyof LineItem, value: any) => void;
  onRemoveLineItem: (itemId: string) => void;
  formatCurrency: (value: number) => string;
  inventoryWarnings?: InventoryWarning[];
  isCheckingInventory?: boolean;
  selectedLineItemId?: string | null;
  onSelectLineItem?: (itemId: string | null) => void;
  focusTrigger?: { field: 'quantity' | 'discount' | null; timestamp: number };
  inventorySearchRef?: RefObject<HTMLInputElement | null>;
  // Enhanced editing support
  editingCell?: EditingCell;
  onStartEditing?: (rowId: string, field: EditableField) => void;
  onStopEditing?: () => void;
  // Layout mode
  compact?: boolean;
}

export function InvoiceLineItemsTable({
  lineItems,
  itemSearch,
  setItemSearch,
  itemOptions,
  isSearchingItems,
  onItemSearchChange,
  onItemSelect,
  onUpdateLineItem,
  onRemoveLineItem,
  formatCurrency,
  inventoryWarnings = [],
  isCheckingInventory = false,
  selectedLineItemId,
  onSelectLineItem,
  focusTrigger,
  inventorySearchRef,
  editingCell,
  onStartEditing,
  onStopEditing,
  compact = false,
}: InvoiceLineItemsTableProps) {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();

  // Row height based on mode
  const rowHeight = compact ? 40 : 56;

  // Refs for quantity and discount inputs (for keyboard focus shortcuts)
  const quantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const discountRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Handle focus triggers from parent (legacy)
  useEffect(() => {
    if (focusTrigger && focusTrigger.field && selectedLineItemId) {
      const refs = focusTrigger.field === 'quantity' ? quantityRefs : discountRefs;
      const input = refs.current[selectedLineItemId];
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [focusTrigger, selectedLineItemId]);

  // Handle editingCell focus
  useEffect(() => {
    if (editingCell?.rowId && editingCell?.field) {
      let input: HTMLInputElement | null = null;
      if (editingCell.field === 'quantity') {
        input = quantityRefs.current[editingCell.rowId];
      } else if (editingCell.field === 'discount') {
        input = discountRefs.current[editingCell.rowId];
      }
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [editingCell]);

  // Check if a specific cell is being edited
  const isCellEditing = (rowId: string, field: EditableField) => {
    return editingCell?.rowId === rowId && editingCell?.field === field;
  };

  // Handle cell click to start editing
  const handleCellClick = (rowId: string, field: EditableField) => {
    onSelectLineItem?.(rowId);
    onStartEditing?.(rowId, field);
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      onStopEditing?.();
    }, 150);
  };

  // Get warning for specific SKU
  const getWarningForSku = (sku: string): InventoryWarning | undefined => {
    return inventoryWarnings.find((w) => w.sku === sku);
  };
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Paper withBorder p="md" radius="md" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
          {/* Add item search */}
          <Autocomplete
            placeholder="Search SKU or description to add item..."
            value={itemSearch}
            onChange={(value) => {
              setItemSearch(value);
              onItemSearchChange(value);
            }}
            onOptionSubmit={onItemSelect}
            data={itemOptions.map((o) => ({ value: o.value, label: o.label }))}
            leftSection={<IconPlus size={16} />}
            rightSection={isSearchingItems ? <Loader size={16} /> : null}
            ref={inventorySearchRef}
            size={compact ? 'xs' : 'sm'}
          />

        {lineItems.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>SKU</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th ta="center" w={80}>
                  Qty
                </Table.Th>
                <Table.Th ta="right" w={100}>
                  Unit Price
                </Table.Th>
                <Table.Th ta="right" w={80}>
                  Disc %
                </Table.Th>
                <Table.Th ta="right" w={100}>
                  Amount
                </Table.Th>
                <Table.Th w={50}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lineItems.map((item, idx) => {
                const warning = getWarningForSku(item.sku);
                const isSelected = selectedLineItemId === item.id;
                const isEditingQty = isCellEditing(item.id, 'quantity');
                const isEditingPrice = isCellEditing(item.id, 'unitPrice');
                const isEditingDiscount = isCellEditing(item.id, 'discount');
                return (
                  <React.Fragment key={`${item.id}-${idx}`}>
                    <Table.Tr
                      onClick={() => onSelectLineItem?.(item.id)}
                      style={{
                        height: rowHeight,
                        backgroundColor: isSelected
                          ? colorScheme === 'dark'
                            ? theme.colors.blue[9]
                            : theme.colors.blue[1]
                          : undefined,
                        cursor: 'pointer',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <Table.Td style={{ height: rowHeight, whiteSpace: 'nowrap' }}>
                        <Group gap="xs" wrap="nowrap">
                          <TextInput
                            size={compact ? 'xs' : 'sm'}
                            variant="unstyled"
                            value={item.sku}
                            onChange={(e) => onUpdateLineItem(item.id, 'sku', e.currentTarget.value)}
                            placeholder="SKU"
                            styles={{ input: { minWidth: 80, fontSize: compact ? 12 : 14 } }}
                          />
                          {item.sku && <CopyButton value={item.sku} />}
                          {warning && (
                            <Tooltip label={`Low stock: ${warning.availableQty} available`}>
                              <Badge color="orange" variant="light" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                                Low
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ height: rowHeight }}>
                        <TextInput
                          size={compact ? 'xs' : 'sm'}
                          variant="unstyled"
                          value={item.description}
                          onChange={(e) => onUpdateLineItem(item.id, 'description', e.currentTarget.value)}
                          placeholder="Description"
                          styles={{ input: { fontSize: compact ? 12 : 16, fontWeight: 500 } }}
                        />
                      </Table.Td>
                      <Table.Td
                        style={{ height: rowHeight, cursor: 'text' }}
                        onClick={(e) => { e.stopPropagation(); handleCellClick(item.id, 'quantity'); }}
                      >
                        <NumberInput
                          ref={(el) => {
                            if (el) {
                              quantityRefs.current[item.id] = el as any;
                            }
                          }}
                          size={compact ? 'xs' : 'sm'}
                          variant={isEditingQty ? 'default' : 'unstyled'}
                          value={item.quantity}
                          onChange={(value) => onUpdateLineItem(item.id, 'quantity', value || 0)}
                          onBlur={handleInputBlur}
                          min={0}
                          ta="center"
                          styles={{ input: { fontSize: compact ? 12 : 14, fontWeight: 600 } }}
                        />
                      </Table.Td>
                      <Table.Td ta="right" style={{ height: rowHeight }}>
                        <Text size={compact ? 'sm' : 'md'}>
                          {formatCurrency(item.unitPrice)}
                        </Text>
                      </Table.Td>
                      <Table.Td
                        style={{ height: rowHeight, cursor: 'text' }}
                        onClick={(e) => { e.stopPropagation(); handleCellClick(item.id, 'discount'); }}
                      >
                        <NumberInput
                          ref={(el) => {
                            if (el) {
                              discountRefs.current[item.id] = el as any;
                            }
                          }}
                          size={compact ? 'xs' : 'sm'}
                          variant={isEditingDiscount ? 'default' : 'unstyled'}
                          value={item.discount}
                          onChange={(value) => onUpdateLineItem(item.id, 'discount', value || 0)}
                          onBlur={handleInputBlur}
                          min={0}
                          max={100}
                          ta="right"
                          styles={{ input: { fontSize: compact ? 12 : 14 } }}
                        />
                      </Table.Td>
                      <Table.Td ta="right" style={{ height: rowHeight }}>
                        <Text size={compact ? 'sm' : 'md'} fw={600}>
                          {formatCurrency(item.amount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" justify="flex-end">
                          {warning && warning.hasAlternates && (
                            <Menu position="bottom-end" shadow="md" width={300}>
                              <Menu.Target>
                                <Tooltip label="Replace with alternative">
                                  <ActionIcon variant="light" color="blue" size="sm">
                                    <IconReplace size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>Available Alternatives</Menu.Label>
                                {warning.alternates.map((alt) => (
                                  <Menu.Item
                                    key={alt.sku}
                                    onClick={() => {
                                      onUpdateLineItem(item.id, 'sku', alt.sku);
                                      onUpdateLineItem(item.id, 'description', alt.description);
                                    }}
                                    rightSection={
                                      <Badge color="green" variant="light" size="sm">
                                        {alt.availableQty}
                                      </Badge>
                                    }
                                  >
                                    <Stack gap={2}>
                                      <Text size="sm" fw={500}>
                                        {alt.sku}
                                      </Text>
                                      <Text size="xs" c="dimmed">
                                        {alt.description}
                                      </Text>
                                    </Stack>
                                  </Menu.Item>
                                ))}
                              </Menu.Dropdown>
                            </Menu>
                          )}
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onRemoveLineItem(item.id)}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    {warning && (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
                            <Text size="sm">
                              <strong>Inventory Warning:</strong> Requested {warning.requestedQty} but only{' '}
                              {warning.availableQty} available.
                              {warning.hasAlternates && (
                                <> {warning.alternates.length} alternative(s) available - click the replace button.</>
                              )}
                            </Text>
                          </Alert>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </React.Fragment>
                );
              })}
            </Table.Tbody>
          </Table>
        ) : (
          <Center py="xl">
            <Text c="dimmed" size="sm">
              No line items. Search and add items above.
            </Text>
          </Center>
        )}
        </Stack>
      </Paper>
    </Box>
  );
}
