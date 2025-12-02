import { Modal, Stack, Text, Group, Kbd, Table, Divider } from '@mantine/core';
import { useKeyboardShortcutContext } from '../../contexts/KeyboardShortcutContext';

const navigationShortcuts = [
  { shortcut: 'Alt+H', description: 'Go to Home' },
  { shortcut: 'Alt+I', description: 'Create Invoice' },
  { shortcut: 'Alt+Q', description: 'Create Quotation' },
  { shortcut: 'Alt+S', description: 'Search Inventory' },
  { shortcut: 'Alt+F', description: 'Search Invoices' },
  { shortcut: 'Alt+P', description: 'Process Payments' },
  { shortcut: 'Alt+C', description: 'Clock In/Out' },
  { shortcut: 'Alt+D', description: 'Dashboard' },
];

const generalShortcuts = [
  { shortcut: '?', description: 'Show this help' },
  { shortcut: 'Escape', description: 'Close modal/dialog' },
];

const formShortcuts = [
  { shortcut: 'Tab', description: 'Next field' },
  { shortcut: 'Shift+Tab', description: 'Previous field' },
  { shortcut: 'Enter', description: 'Submit form / Activate button' },
];

interface ShortcutRowProps {
  shortcut: string;
  description: string;
}

function ShortcutRow({ shortcut, description }: ShortcutRowProps) {
  const keys = shortcut.split('+');
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4}>
          {keys.map((key, index) => (
            <span key={key}>
              <Kbd size="sm">{key}</Kbd>
              {index < keys.length - 1 && <Text span mx={4}>+</Text>}
            </span>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{description}</Text>
      </Table.Td>
    </Table.Tr>
  );
}

interface ShortcutTableProps {
  title: string;
  shortcuts: ShortcutRowProps[];
}

function ShortcutTable({ title, shortcuts }: ShortcutTableProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600} c="dimmed">
        {title}
      </Text>
      <Table>
        <Table.Tbody>
          {shortcuts.map((shortcut) => (
            <ShortcutRow key={shortcut.shortcut} {...shortcut} />
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

export function KeyboardShortcutHelp() {
  const { isHelpOpen, closeHelp } = useKeyboardShortcutContext();

  return (
    <Modal
      opened={isHelpOpen}
      onClose={closeHelp}
      title="Keyboard Shortcuts"
      size="md"
      centered
    >
      <Stack gap="lg">
        <ShortcutTable title="Navigation" shortcuts={navigationShortcuts} />
        <Divider />
        <ShortcutTable title="General" shortcuts={generalShortcuts} />
        <Divider />
        <ShortcutTable title="Forms" shortcuts={formShortcuts} />
      </Stack>
    </Modal>
  );
}
