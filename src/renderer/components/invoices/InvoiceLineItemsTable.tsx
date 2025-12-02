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
} from '@mantine/core';
import { IconPlus, IconTrash, IconAlertTriangle, IconReplace } from '@tabler/icons-react';
import type { InventoryWarning } from './InventoryWarningModal';

export interface LineItem {
  id: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  isTaxable: boolean;
  amount: number;
  inventoryId?: number;
}

interface InventoryItem {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
  price: string;
  cost: string;
  quantity: number;
  isTaxable: boolean;
}

interface InvoiceLineItemsTableProps {
  lineItems: LineItem[];
  itemSearch: string;
  setItemSearch: (value: string) => void;
  itemOptions: { value: string; label: string; item: InventoryItem }[];
  isSearchingItems: boolean;
  onItemSearchChange: (value: string) => void;
  onItemSelect: (value: string) => void;
  onUpdateLineItem: (itemId: string, field: keyof LineItem, value: any) => void;
  onRemoveLineItem: (itemId: string) => void;
  formatCurrency: (value: number) => string;
  inventoryWarnings?: InventoryWarning[];
  isCheckingInventory?: boolean;
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
}: InvoiceLineItemsTableProps) {
  // Get warning for specific SKU
  const getWarningForSku = (sku: string): InventoryWarning | undefined => {
    return inventoryWarnings.find((w) => w.sku === sku);
  };
  return (
    <Paper withBorder p="md" radius="md" mt="md">
      <Stack gap="md">
        <Text fw={600}>Line Items</Text>

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
              {lineItems.map((item) => {
                const warning = getWarningForSku(item.sku);
                return (
                  <>
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <TextInput
                            size="xs"
                            variant="unstyled"
                            value={item.sku}
                            onChange={(e) => onUpdateLineItem(item.id, 'sku', e.currentTarget.value)}
                            placeholder="SKU"
                            styles={{ input: { minWidth: 80 } }}
                          />
                          {warning && (
                            <Tooltip label={`Low stock: ${warning.availableQty} available`}>
                              <Badge color="orange" variant="light" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                                Low
                              </Badge>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          variant="unstyled"
                          value={item.description}
                          onChange={(e) => onUpdateLineItem(item.id, 'description', e.currentTarget.value)}
                          placeholder="Description"
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={item.quantity}
                          onChange={(value) => onUpdateLineItem(item.id, 'quantity', value || 0)}
                          min={0}
                          ta="center"
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={item.unitPrice}
                          onChange={(value) => onUpdateLineItem(item.id, 'unitPrice', value || 0)}
                          min={0}
                          decimalScale={2}
                          fixedDecimalScale
                          ta="right"
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="xs"
                          variant="unstyled"
                          value={item.discount}
                          onChange={(value) => onUpdateLineItem(item.id, 'discount', value || 0)}
                          min={0}
                          max={100}
                          ta="right"
                        />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={500}>
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
                  </>
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
  );
}
