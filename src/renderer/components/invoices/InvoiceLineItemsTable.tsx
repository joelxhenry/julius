import React, { useRef, useEffect, KeyboardEvent } from 'react';
import {
  Stack,
  Text,
  Paper,
  Table,
  ActionIcon,
  Center,
  TextInput,
  NumberInput,
  Badge,
  Group,
  Tooltip,
  Menu,
  Alert,
  useMantineTheme,
  useMantineColorScheme,
  Box,
} from '@mantine/core';
import { IconTrash, IconAlertTriangle, IconReplace } from '@tabler/icons-react';
import { CopyButton, PartLabels } from '../common';
import { ProductSearchPanel, type ProductSearchPanelHandle } from './ProductSearchPanel';
import { useProductSearch, type ProductSearchItem } from '../../hooks/useProductSearch';
import { usePartLabels } from '../../hooks/usePartLabels';
import type { InventoryWarning } from './InventoryWarningModal';
import type { LineItem } from '../../../shared/types/inventory';
import type { EditingCell, EditableField } from '../../hooks/useLineItems';

// Re-export LineItem for backwards compatibility
export type { LineItem };

interface InvoiceLineItemsTableProps {
  lineItems: LineItem[];
  /** Called when a product is chosen from the multi-field search results. */
  onProductSelect: (item: ProductSearchItem) => void;
  onUpdateLineItem: (itemId: string, field: keyof LineItem, value: any) => void;
  onRemoveLineItem: (itemId: string) => void;
  formatCurrency: (value: number) => string;
  inventoryWarnings?: InventoryWarning[];
  isCheckingInventory?: boolean;
  selectedLineItemId?: string | null;
  onSelectLineItem?: (itemId: string | null) => void;
  focusTrigger?: { field: 'quantity' | 'discount' | null; timestamp: number };
  // Enhanced editing support
  editingCell?: EditingCell;
  onStartEditing?: (rowId: string, field: EditableField) => void;
  onStopEditing?: () => void;
  // Layout mode
  compact?: boolean;
}

export function InvoiceLineItemsTable({
  lineItems,
  onProductSelect,
  onUpdateLineItem,
  onRemoveLineItem,
  formatCurrency,
  inventoryWarnings = [],
  isCheckingInventory = false,
  selectedLineItemId,
  onSelectLineItem,
  focusTrigger,
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

  // Multi-field product search (part#/description, category, model).
  const productSearch = useProductSearch();
  const searchPanelRef = useRef<ProductSearchPanelHandle>(null);

  // Category/model labels for the parts on the current lines, so make/category
  // always show on a line item regardless of how it was entered.
  const partLabels = usePartLabels(lineItems.map((li) => li.sku));

  const handleProductSelect = (item: ProductSearchItem) => {
    onProductSelect(item);
    // Clear the free-text query so the next search starts fresh; any active
    // category/model filter is kept so the user can keep browsing.
    productSearch.setQuery('');
  };

  // --- Keyboard navigation between line-item cells and the search fields ---
  // quantity <-> discount (horizontal), rows (vertical), wrapping back up to
  // the search/filter fields at the top or bottom of the list.
  const focusSearch = () => searchPanelRef.current?.focus();

  const focusCell = (rowId: string, field: 'quantity' | 'discount') => {
    const refs = field === 'quantity' ? quantityRefs : discountRefs;
    const input = refs.current[rowId];
    if (input) {
      input.focus();
      input.select();
    }
    onSelectLineItem?.(rowId);
    onStartEditing?.(rowId, field);
  };

  const handleCellKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    idx: number,
    field: 'quantity' | 'discount'
  ) => {
    const input = e.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd =
      input.selectionStart === input.value.length && input.selectionEnd === input.value.length;

    if (e.key === 'ArrowRight' && field === 'quantity' && atEnd) {
      e.preventDefault();
      focusCell(lineItems[idx].id, 'discount');
    } else if (e.key === 'ArrowLeft' && field === 'discount' && atStart) {
      e.preventDefault();
      focusCell(lineItems[idx].id, 'quantity');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx < lineItems.length - 1) {
        focusCell(lineItems[idx + 1].id, field);
      } else {
        focusSearch();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx > 0) {
        focusCell(lineItems[idx - 1].id, field);
      } else {
        focusSearch();
      }
    }
  };

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
    <Box>
      <Stack gap="md">
        {/* Multi-field product search + navigable results list */}
        <ProductSearchPanel
          ref={searchPanelRef}
          query={productSearch.query}
          setQuery={productSearch.setQuery}
          category={productSearch.category}
          setCategory={productSearch.setCategory}
          model={productSearch.model}
          setModel={productSearch.setModel}
          results={productSearch.results}
          isSearching={productSearch.isSearching}
          categoryOptions={productSearch.categoryOptions}
          modelOptions={productSearch.modelOptions}
          onSelectProduct={handleProductSelect}
          compact={compact}
        />

      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
        {lineItems.length > 0 ? (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Part Number</Table.Th>
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
                            placeholder="Part Number"
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
                        <Stack gap={0}>
                          <TextInput
                            size={compact ? 'xs' : 'sm'}
                            variant="unstyled"
                            value={item.description}
                            onChange={(e) => onUpdateLineItem(item.id, 'description', e.currentTarget.value)}
                            placeholder="Description"
                            styles={{ input: { fontSize: compact ? 12 : 16, fontWeight: 500 } }}
                          />
                          <PartLabels
                            category={partLabels[item.sku]?.category}
                            model={partLabels[item.sku]?.model}
                          />
                        </Stack>
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
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'quantity')}
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
                          onKeyDown={(e) => handleCellKeyDown(e, idx, 'discount')}
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
      </Stack>
    </Box>
  );
}
