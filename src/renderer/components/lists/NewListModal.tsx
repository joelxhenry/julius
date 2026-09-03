import { useEffect, useState } from 'react';
import { Modal, Stack, TextInput, Textarea, Group, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../contexts/AuthContext';
import { productListsApi } from '../../hooks/useProductLists';
import { employeeDisplayName } from '../../utils/employeeName';
import type { ProductList } from '../../../shared/types/productList';

interface NewListModalProps {
  opened: boolean;
  onClose: () => void;
  /** Called with the created list so the caller can navigate to it. */
  onCreated?: (list: ProductList) => void;
}

export function NewListModal({ opened, onClose, onCreated }: NewListModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setTitle('');
      setNote('');
    }
  }, [opened]);

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      notifications.show({ title: 'Title required', message: 'Give the list a title.', color: 'yellow' });
      return;
    }
    setSubmitting(true);
    try {
      const list = await productListsApi.create({
        title: cleanTitle,
        note: note.trim() || null,
        createdByEmployeeId: user?.id ?? null,
        createdByName: user ? employeeDisplayName(user) : null,
      });
      notifications.show({ title: 'List created', message: `"${list.title}" created.`, color: 'green' });
      onCreated?.(list);
      onClose();
    } catch (err) {
      notifications.show({
        title: 'Could not create list',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="New list" centered>
      <Stack gap="md">
        <TextInput
          label="List title"
          placeholder="e.g. Reorder — Toyota fast movers"
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          data-autofocus
        />
        <Textarea
          label="Note"
          placeholder="What is this list for?"
          autosize
          minRows={2}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
