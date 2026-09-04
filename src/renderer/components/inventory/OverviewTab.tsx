import { useState } from 'react';
import { Paper, Stack, Title, SimpleGrid, Text, Group, Textarea, Button, Tooltip } from '@mantine/core';
import { IconDeviceFloppy, IconX, IconNotes } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { CopyButton } from '../common';
import { normalizeToArray } from '../../../shared/utils/arrayFields';
import { IpcChannel } from '../../../shared/types/ipc';
import { usePermissions } from '../../permissions';

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  minLevel: number;
  isTaxable: boolean;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  margin: string | null;
  unit: string;
  category: string | null;
  model: string | null;
  wholesalePrice: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OverviewTabProps {
  item: Inventory;
  /** Called after notes are persisted so the parent can reflect the new value. */
  onNotesSaved?: (notes: string | null) => void;
}

export function OverviewTab({ item, onNotesSaved }: OverviewTabProps) {
  const { runWithPermission } = usePermissions();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    runWithPermission(
      {
        permissionCode: 'EDIT_INVENTORY_NOTES',
        actionLabel: `Edit notes for ${item.sku}`,
        context: { entity: 'inventory', id: item.id },
      },
      () => {
        setDraft(item.notes ?? '');
        setEditing(true);
      }
    );
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trimmed = draft.trim();
      const notes = trimmed.length > 0 ? trimmed : null;
      const result = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY, {
        id: item.id,
        data: { notes },
      });

      if (result.success) {
        notifications.show({
          title: 'Notes Saved',
          message: `Notes updated for ${item.sku}`,
          color: 'green',
          icon: <IconDeviceFloppy size={16} />,
        });
        onNotesSaved?.(notes);
        setEditing(false);
        setDraft('');
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to save notes',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Product Details</Title>
          <SimpleGrid cols={2}>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Part Number
              </Text>
              <Group gap="xs">
                <Text fw={500}>{item.sku}</Text>
                <CopyButton value={item.sku} />
              </Group>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Unit
              </Text>
              <Text fw={500}>{item.unit}</Text>
            </Stack>
          </SimpleGrid>
          {(() => {
            const categories = normalizeToArray(item.category);
            const models = normalizeToArray(item.model);
            const values = [...categories, ...models];
            return (
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  Vehicle &amp; Models
                </Text>
                <Text fw={500}>{values.length > 0 ? values.join(', ') : '-'}</Text>
              </Stack>
            );
          })()}
          {item.description2 && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Additional Description
              </Text>
              <Text>{item.description2}</Text>
            </Stack>
          )}

          {/* Notes — click the value to edit in place, gated by EDIT_INVENTORY_NOTES */}
          <Stack gap={4}>
            <Group gap={6}>
              <IconNotes size={14} />
              <Text size="xs" c="dimmed">
                Notes
              </Text>
            </Group>

            {editing ? (
              <Stack gap="xs">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.currentTarget.value)}
                  placeholder="Add notes about this part for future reference…"
                  autosize
                  minRows={3}
                  maxRows={10}
                  autoFocus
                  disabled={saving}
                />
                <Group gap="xs" justify="flex-end">
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconX size={14} />}
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    leftSection={<IconDeviceFloppy size={14} />}
                    onClick={handleSave}
                    loading={saving}
                  >
                    Save
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Tooltip label="Click to edit notes" position="top-start" openDelay={400}>
                <Text
                  onClick={startEditing}
                  c={item.notes ? undefined : 'dimmed'}
                  fs={item.notes ? undefined : 'italic'}
                  style={{ whiteSpace: 'pre-wrap', cursor: 'text' }}
                >
                  {item.notes || 'Add notes about this part…'}
                </Text>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Paper>
  );
}
