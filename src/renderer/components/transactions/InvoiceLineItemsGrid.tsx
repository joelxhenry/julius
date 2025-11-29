import { Table, ActionIcon, NumberInput, Group, Button } from '@mantine/core';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { calculateLineTotal } from '../../utils/calculations';
import { usePartVariants, type PartVariantWithPart } from '../../hooks';
import { AsyncSelect, type AsyncSelectOption } from '../common/AsyncSelect';
import numeral from 'numeral';

export interface InvoiceLineItem {
  id?: number;
  partVariantId: number | null;
  partName: string;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxRate: string;
  lineTotal: number;
}

interface InvoiceLineItemsGridProps {
  items: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
  readonly?: boolean;
}

export function InvoiceLineItemsGrid({ items, onChange, readonly = false }: InvoiceLineItemsGridProps) {
  const { searchForSelect } = usePartVariants();
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const [focusedCol, setFocusedCol] = useState<number | null>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [variantCache, setVariantCache] = useState<Map<string, PartVariantWithPart>>(new Map());

  // Search function for AsyncSelect
  const handlePartSearch = useCallback(async (query: string): Promise<AsyncSelectOption[]> => {
    const results = await searchForSelect(query, 20);
    // Cache the variants for later lookup
    setVariantCache((prev) => {
      const newCache = new Map(prev);
      results.forEach((v) => {
        newCache.set(`${v.id}`, v);
      });
      return newCache;
    });

    return results.map((v) => ({
      value: v.id.toString(),
      label: `${v.partName} - ${v.name || 'Standard'} (${v.sku})`,
    }));
  }, [searchForSelect]);

  const handleAddLine = () => {
    const newItem: InvoiceLineItem = {
      partVariantId: null,
      partName: '',
      quantity: 1,
      unitPrice: '0.00',
      discount: '0.00',
      taxRate: '0.00',
      lineTotal: 0,
    };
    onChange([...items, newItem]);
  };

  const handleRemoveLine = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };

    // If part variant changed, populate price and tax rate
    if (field === 'partVariantId' && value) {
      const variant = variantCache.get(value.toString());
      if (variant) {
        item.partName = `${variant.partName} - ${variant.name || 'Standard'}`;
        item.unitPrice = variant.price || '0.00';
        item.taxRate = variant.taxable ? '15.00' : '0.00'; // Default tax rate
      }
    }

    // Recalculate line total
    item.lineTotal = calculateLineTotal({
      partVariantId: item.partVariantId || 0,
      partName: item.partName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
    });

    newItems[index] = item;
    onChange(newItems);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (readonly) return;

    const totalRows = items.length;
    const totalCols = 5; // part, quantity, unitPrice, discount, taxRate

    let newRow = rowIndex;
    let newCol = colIndex;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        newRow = Math.min(rowIndex + 1, totalRows - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        newRow = Math.max(rowIndex - 1, 0);
        break;
      case 'ArrowRight':
      case 'Tab':
        if (!e.shiftKey) {
          e.preventDefault();
          newCol = colIndex + 1;
          if (newCol >= totalCols) {
            newCol = 0;
            newRow = Math.min(rowIndex + 1, totalRows - 1);
          }
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newCol = Math.max(colIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        newRow = Math.min(rowIndex + 1, totalRows - 1);
        break;
    }

    if (newRow !== rowIndex || newCol !== colIndex) {
      setFocusedRow(newRow);
      setFocusedCol(newCol);
      const key = `${newRow}-${newCol}`;
      inputRefs.current[key]?.focus();
    }
  };

  useEffect(() => {
    if (focusedRow !== null && focusedCol !== null) {
      const key = `${focusedRow}-${focusedCol}`;
      inputRefs.current[key]?.focus();
    }
  }, [focusedRow, focusedCol]);

  if (readonly && items.length === 0) {
    return <div>No line items</div>;
  }

  return (
    <div>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: '40%' }}>Part</Table.Th>
            <Table.Th style={{ width: '10%' }}>Qty</Table.Th>
            <Table.Th style={{ width: '15%' }}>Unit Price</Table.Th>
            <Table.Th style={{ width: '15%' }}>Discount</Table.Th>
            <Table.Th style={{ width: '10%' }}>Tax %</Table.Th>
            <Table.Th style={{ width: '15%' }}>Line Total</Table.Th>
            {!readonly && <Table.Th style={{ width: '50px' }}></Table.Th>}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item, index) => (
            <Table.Tr key={index}>
              <Table.Td>
                {readonly ? (
                  item.partName
                ) : (
                  <AsyncSelect
                    value={item.partVariantId?.toString() || null}
                    onChange={(value) => handleItemChange(index, 'partVariantId', value ? parseInt(value) : null)}
                    onSearch={handlePartSearch}
                    placeholder="Search part..."
                    initialOptions={item.partVariantId ? [{
                      value: item.partVariantId.toString(),
                      label: item.partName,
                    }] : []}
                  />
                )}
              </Table.Td>
              <Table.Td>
                {readonly ? (
                  item.quantity
                ) : (
                  <NumberInput
                    value={item.quantity}
                    onChange={(value) => handleItemChange(index, 'quantity', value || 0)}
                    min={0}
                    step={1}
                    hideControls
                    ref={(el) => {
                      if (el) inputRefs.current[`${index}-1`] = el as any;
                    }}
                    onKeyDown={(e) => handleKeyDown(e, index, 1)}
                  />
                )}
              </Table.Td>
              <Table.Td>
                {readonly ? (
                  numeral(item.unitPrice).format('$0,0.00')
                ) : (
                  <NumberInput
                    value={parseFloat(item.unitPrice) || 0}
                    onChange={(value) => handleItemChange(index, 'unitPrice', (value || 0).toString())}
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator=","
                    hideControls
                    ref={(el) => {
                      if (el) inputRefs.current[`${index}-2`] = el as any;
                    }}
                    onKeyDown={(e) => handleKeyDown(e, index, 2)}
                  />
                )}
              </Table.Td>
              <Table.Td>
                {readonly ? (
                  numeral(item.discount).format('$0,0.00')
                ) : (
                  <NumberInput
                    value={parseFloat(item.discount) || 0}
                    onChange={(value) => handleItemChange(index, 'discount', (value || 0).toString())}
                    prefix="$"
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator=","
                    hideControls
                    ref={(el) => {
                      if (el) inputRefs.current[`${index}-3`] = el as any;
                    }}
                    onKeyDown={(e) => handleKeyDown(e, index, 3)}
                  />
                )}
              </Table.Td>
              <Table.Td>
                {readonly ? (
                  `${item.taxRate}%`
                ) : (
                  <NumberInput
                    value={parseFloat(item.taxRate) || 0}
                    onChange={(value) => handleItemChange(index, 'taxRate', (value || 0).toString())}
                    suffix="%"
                    decimalScale={2}
                    fixedDecimalScale
                    min={0}
                    max={100}
                    hideControls
                    ref={(el) => {
                      if (el) inputRefs.current[`${index}-4`] = el as any;
                    }}
                    onKeyDown={(e) => handleKeyDown(e, index, 4)}
                  />
                )}
              </Table.Td>
              <Table.Td>
                <strong>{numeral(item.lineTotal).format('$0,0.00')}</strong>
              </Table.Td>
              {!readonly && (
                <Table.Td>
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => handleRemoveLine(index)}
                    disabled={items.length === 1}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {!readonly && (
        <Group mt="md">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddLine}
          >
            Add Line Item
          </Button>
        </Group>
      )}
    </div>
  );
}
