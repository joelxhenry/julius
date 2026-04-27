import { Modal, Stack, Text, Alert, Table, Badge, Button, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconAlertTriangle, IconReplace, IconX } from '@tabler/icons-react';

export interface InventoryWarning {
  sku: string;
  requestedQty: number;
  availableQty: number;
  hasAlternates: boolean;
  alternates: Array<{
    sku: string;
    description: string;
    availableQty: number;
  }>;
}

interface InventoryWarningModalProps {
  opened: boolean;
  onClose: () => void;
  warnings: InventoryWarning[];
  onReplaceItem: (originalSku: string, newSku: string) => void;
  onProceedAnyway: () => void;
}

export function InventoryWarningModal({
  opened,
  onClose,
  warnings,
  onReplaceItem,
  onProceedAnyway,
}: InventoryWarningModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Inventory Availability Warning"
      size="lg"
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Low Stock Items">
          <Text size="sm">
            The following items have insufficient inventory. You can replace them with alternatives or proceed
            anyway (this will create a backorder).
          </Text>
        </Alert>

        <Stack gap="lg">
          {warnings.map((warning, idx) => (
            <Stack key={idx} gap="xs">
              <Group justify="space-between">
                <div>
                  <Text fw={500}>{warning.sku}</Text>
                  <Text size="sm" c="dimmed">
                    Requested: {warning.requestedQty} | Available: {warning.availableQty}
                  </Text>
                </div>
                <Badge color="orange">
                  Short by {warning.requestedQty - warning.availableQty}
                </Badge>
              </Group>

              {warning.hasAlternates && (
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    Available Alternatives:
                  </Text>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Part Number</Table.Th>
                        <Table.Th>Description</Table.Th>
                        <Table.Th ta="center">Available</Table.Th>
                        <Table.Th w={60}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {warning.alternates.map((alt) => (
                        <Table.Tr key={alt.sku}>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {alt.sku}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{alt.description}</Text>
                          </Table.Td>
                          <Table.Td ta="center">
                            <Badge color="green" variant="light">
                              {alt.availableQty}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Replace with this item">
                              <ActionIcon
                                variant="light"
                                color="blue"
                                onClick={() => {
                                  onReplaceItem(warning.sku, alt.sku);
                                  onClose();
                                }}
                              >
                                <IconReplace size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              )}

              {!warning.hasAlternates && (
                <Alert color="red" icon={<IconX size={16} />}>
                  <Text size="sm">No alternatives available with sufficient stock.</Text>
                </Alert>
              )}
            </Stack>
          ))}
        </Stack>

        <Group justify="space-between" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="orange"
            onClick={() => {
              onProceedAnyway();
              onClose();
            }}
          >
            Proceed Anyway (Backorder)
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
