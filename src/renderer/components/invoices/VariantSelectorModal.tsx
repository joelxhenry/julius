import { Modal, Stack, Text, Table, Badge, Button, Group, Loader, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string;
  attributes: Record<string, any>;
  quantity: number;
  price: string;
  isActive: boolean;
}

interface VariantSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  parentSku: string;
  variants: Variant[];
  isLoading: boolean;
  onSelectVariant: (variant: Variant) => void;
}

export function VariantSelectorModal({
  opened,
  onClose,
  parentSku,
  variants,
  isLoading,
  onSelectVariant,
}: VariantSelectorModalProps) {
  const formatAttributes = (attributes: Record<string, any>) => {
    if (!attributes || Object.keys(attributes).length === 0) {
      return 'No attributes';
    }
    return Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    return isNaN(numPrice) ? '$0.00' : `$${numPrice.toFixed(2)}`;
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Select Variant for ${parentSku}`}
      size="lg"
    >
      <Stack gap="md">
        {isLoading && (
          <Group justify="center" py="xl">
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Loading variants...
            </Text>
          </Group>
        )}

        {!isLoading && variants.length === 0 && (
          <Alert icon={<IconAlertCircle size={16} />} color="blue" title="No Variants Found">
            <Text size="sm">
              No active variants found for SKU {parentSku}. The parent item will be added instead.
            </Text>
          </Alert>
        )}

        {!isLoading && variants.length > 0 && (
          <>
            <Text size="sm" c="dimmed">
              Select a variant to add to the invoice:
            </Text>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Variant</Table.Th>
                  <Table.Th>Attributes</Table.Th>
                  <Table.Th ta="center">Stock</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th w={100}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {variants.map((variant) => (
                  <Table.Tr key={variant.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" fw={500}>
                          {variant.variantName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {variant.variantSku}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatAttributes(variant.attributes)}</Text>
                    </Table.Td>
                    <Table.Td ta="center">
                      <Badge
                        color={variant.quantity > 10 ? 'green' : variant.quantity > 0 ? 'orange' : 'red'}
                        variant="light"
                      >
                        {variant.quantity}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={500}>
                        {formatPrice(variant.price)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={() => {
                          onSelectVariant(variant);
                          onClose();
                        }}
                        disabled={!variant.isActive}
                      >
                        Select
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
