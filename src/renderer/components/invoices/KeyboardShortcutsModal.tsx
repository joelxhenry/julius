import { Modal, Stack, Text, Table, Badge, Group, Divider } from '@mantine/core';

interface KeyboardShortcutsModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ShortcutInfo {
  keys: string[];
  description: string;
}

const lineItemShortcuts: ShortcutInfo[] = [
  { keys: ['Ctrl', 'Q'], description: 'Focus quantity field of selected line item' },
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Focus discount field of selected line item' },
  { keys: ['Delete'], description: 'Delete selected line item' },
  { keys: ['↑'], description: 'Select previous line item' },
  { keys: ['↓'], description: 'Select next line item' },
];

const bulkOperations: ShortcutInfo[] = [
  { keys: ['Ctrl', 'Alt', 'D'], description: 'Apply bulk discount to all line items' },
  { keys: ['Ctrl', 'T'], description: 'Calculate discount for target total' },
];

const invoiceActions: ShortcutInfo[] = [
  { keys: ['Ctrl', 'S'], description: 'Save invoice as draft' },
  { keys: ['Ctrl', 'Shift', 'S'], description: 'Issue invoice' },
];

export function KeyboardShortcutsModal({ opened, onClose }: KeyboardShortcutsModalProps) {
  const renderShortcutRow = (shortcut: ShortcutInfo) => (
    <Table.Tr key={shortcut.description}>
      <Table.Td>
        <Group gap="xs">
          {shortcut.keys.map((key, index) => (
            <span key={index}>
              <Badge variant="light" color="blue" size="md">
                {key}
              </Badge>
              {index < shortcut.keys.length - 1 && <Text span c="dimmed" mx={4}>+</Text>}
            </span>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>{shortcut.description}</Table.Td>
    </Table.Tr>
  );

  return (
    <Modal opened={opened} onClose={onClose} title="Keyboard Shortcuts" size="lg" centered>
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Use these keyboard shortcuts to speed up your invoice creation workflow.
        </Text>

        <Divider />

        {/* Line Item Operations */}
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Line Item Operations
          </Text>
          <Table>
            <Table.Tbody>{lineItemShortcuts.map(renderShortcutRow)}</Table.Tbody>
          </Table>
        </Stack>

        <Divider />

        {/* Bulk Operations */}
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Bulk Discount Operations
          </Text>
          <Table>
            <Table.Tbody>{bulkOperations.map(renderShortcutRow)}</Table.Tbody>
          </Table>
        </Stack>

        <Divider />

        {/* Invoice Actions */}
        <Stack gap="sm">
          <Text fw={600} size="sm">
            Invoice Actions
          </Text>
          <Table>
            <Table.Tbody>{invoiceActions.map(renderShortcutRow)}</Table.Tbody>
          </Table>
        </Stack>
      </Stack>
    </Modal>
  );
}
