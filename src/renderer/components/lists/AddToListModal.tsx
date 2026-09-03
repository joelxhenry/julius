import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  SegmentedControl,
  Select,
  TextInput,
  Textarea,
  Button,
  Group,
  Text,
  Loader,
  Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { productListsApi } from '../../hooks/useProductLists';
import { employeeDisplayName } from '../../utils/employeeName';
import type { AddListItemInput, ProductList } from '../../../shared/types/productList';

interface AddToListModalProps {
  opened: boolean;
  onClose: () => void;
  /** The product snapshot being attached. */
  item: AddListItemInput | null;
  /** Called after a successful add, with the target list's title. */
  onAdded?: (listTitle: string) => void;
}

export function AddToListModal({ opened, onClose, item, onAdded }: AddToListModalProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [openLists, setOpenLists] = useState<ProductList[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [listNote, setListNote] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load open lists whenever the modal opens; reset the form.
  useEffect(() => {
    if (!opened) return;
    setItemNote('');
    setTitle('');
    setListNote('');
    setSelectedListId(null);
    setLoadingLists(true);
    productListsApi
      .searchOpen('', 50)
      .then((lists) => {
        setOpenLists(lists);
        // Default to creating a new list when there are none to add to.
        setMode(lists.length > 0 ? 'existing' : 'new');
      })
      .catch((err) => {
        notifications.show({ title: 'Could not load lists', message: err.message, color: 'red' });
        setMode('new');
      })
      .finally(() => setLoadingLists(false));
  }, [opened]);

  const handleSubmit = async () => {
    if (!item) return;
    const payloadItem: AddListItemInput = { ...item, note: itemNote.trim() || null };
    setSubmitting(true);
    try {
      if (mode === 'existing') {
        if (!selectedListId) {
          notifications.show({ title: 'Pick a list', message: 'Select a list to add to.', color: 'yellow' });
          return;
        }
        const target = openLists.find((l) => String(l.id) === selectedListId);
        const result = await productListsApi.addItem(Number(selectedListId), payloadItem);
        if (result.duplicate) {
          notifications.show({
            title: 'Already on list',
            message: `${item.sku} is already on "${target?.title ?? 'this list'}".`,
            color: 'yellow',
          });
        } else {
          notifications.show({
            title: 'Added to list',
            message: `${item.sku} added to "${target?.title ?? 'list'}".`,
            color: 'green',
          });
          onAdded?.(target?.title ?? 'list');
          onClose();
        }
      } else {
        const cleanTitle = title.trim();
        if (!cleanTitle) {
          notifications.show({ title: 'Title required', message: 'Give the new list a title.', color: 'yellow' });
          return;
        }
        const { list } = await productListsApi.createWithItem(
          {
            title: cleanTitle,
            note: listNote.trim() || null,
            createdByEmployeeId: user?.id ?? null,
            createdByName: user ? employeeDisplayName(user) : null,
          },
          payloadItem
        );
        notifications.show({
          title: 'List created',
          message: `${item.sku} added to new list "${list.title}".`,
          color: 'green',
        });
        onAdded?.(list.title);
        onClose();
      }
    } catch (err) {
      notifications.show({
        title: 'Could not add to list',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add to list" centered>
      <Stack gap="md">
        {item && (
          <Text size="sm" c="dimmed">
            Adding <Text span fw={600} c="var(--mantine-color-text)">{item.sku}</Text>
            {item.description ? ` — ${item.description}` : ''}
          </Text>
        )}

        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as 'existing' | 'new')}
          data={[
            { label: 'Add to existing', value: 'existing' },
            { label: 'Create new', value: 'new' },
          ]}
          fullWidth
        />

        {mode === 'existing' ? (
          loadingLists ? (
            <Center py="md"><Loader size="sm" /></Center>
          ) : (
            <Select
              label="List"
              placeholder={openLists.length ? 'Select an open list' : 'No open lists yet'}
              searchable
              nothingFoundMessage="No matching list"
              disabled={openLists.length === 0}
              value={selectedListId}
              onChange={setSelectedListId}
              data={openLists.map((l) => ({ value: String(l.id), label: l.title }))}
              maxDropdownHeight={240}
            />
          )
        ) : (
          <>
            <TextInput
              label="List title"
              placeholder="e.g. Reorder — Toyota fast movers"
              required
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              data-autofocus
            />
            <Textarea
              label="List note"
              placeholder="What is this list for?"
              autosize
              minRows={2}
              value={listNote}
              onChange={(e) => setListNote(e.currentTarget.value)}
            />
          </>
        )}

        <Textarea
          label="Item note (optional)"
          placeholder="e.g. supplier X only, needed for the Corolla job"
          autosize
          minRows={1}
          value={itemNote}
          onChange={(e) => setItemNote(e.currentTarget.value)}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Add
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
