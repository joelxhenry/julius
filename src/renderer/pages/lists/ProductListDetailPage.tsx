import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTabParams } from '../../hooks/useTabParams';
import {
  Stack,
  Group,
  Title,
  Text,
  Paper,
  Badge,
  Button,
  ActionIcon,
  Tooltip,
  TextInput,
  Textarea,
  Table,
  Loader,
  Center,
  Divider,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconDeviceFloppy,
  IconShoppingCart,
  IconArchive,
  IconRotate,
  IconFileExport,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { InventorySelect } from '../../components/selects/InventorySelect';
import { usePermissions } from '../../permissions';
import { productListsApi } from '../../hooks/useProductLists';
import { printProductList } from './printProductList';
import { IpcChannel } from '../../../shared/types/ipc';
import type {
  ProductListStatus,
  ProductListItem,
  ProductListWithItems,
} from '../../../shared/types/productList';

const STATUS_META: Record<ProductListStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'blue' },
  ordered: { label: 'Ordered', color: 'green' },
  archived: { label: 'Archived', color: 'gray' },
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function ProductListDetailPage() {
  const { id } = useTabParams<{ id: string }>();
  const listId = Number(id);
  const { replaceCurrentTab } = useTabContext();
  const { can } = usePermissions();
  const canManage = can('MANAGE_PRODUCT_LISTS');
  const canExport = can('EXPORT_REPORT');

  const [list, setList] = useState<ProductListWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
  const [addSku, setAddSku] = useState<string | null>(null);
  const [addDescription, setAddDescription] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const applyList = useCallback((data: ProductListWithItems) => {
    setList(data);
    setTitle(data.title);
    setNote(data.note ?? '');
    setItemNotes(Object.fromEntries(data.items.map((it) => [it.id, it.note ?? ''])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productListsApi.get(listId);
      applyList(data);
    } catch (err) {
      notifications.show({
        title: 'Could not load list',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [listId, applyList]);

  useEffect(() => {
    if (Number.isFinite(listId)) load();
  }, [listId, load]);

  const headerDirty = useMemo(
    () => !!list && (title.trim() !== list.title || (note ?? '') !== (list.note ?? '')),
    [list, title, note]
  );

  const saveHeader = async () => {
    if (!list || !title.trim()) {
      notifications.show({ title: 'Title required', message: 'The list needs a title.', color: 'yellow' });
      return;
    }
    setSavingHeader(true);
    try {
      const updated = await productListsApi.update(list.id, { title: title.trim(), note: note.trim() || null });
      setList({ ...list, title: updated.title, note: updated.note });
      notifications.show({ title: 'Saved', message: 'List details updated.', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Could not save',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setSavingHeader(false);
    }
  };

  const changeStatus = async (status: ProductListStatus) => {
    if (!list) return;
    try {
      const updated = await productListsApi.setStatus(list.id, status);
      setList({ ...list, status: updated.status, orderedAt: updated.orderedAt });
      notifications.show({ title: 'Status updated', message: `List marked ${STATUS_META[status].label}.`, color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Could not update status',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    }
  };

  const saveItemNote = async (item: ProductListItem) => {
    const next = itemNotes[item.id] ?? '';
    if (next === (item.note ?? '')) return;
    try {
      await productListsApi.updateItem(item.id, { note: next.trim() || null });
      setList((prev) =>
        prev
          ? { ...prev, items: prev.items.map((it) => (it.id === item.id ? { ...it, note: next.trim() || null } : it)) }
          : prev
      );
    } catch (err) {
      notifications.show({
        title: 'Could not save note',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    }
  };

  const removeItem = async (item: ProductListItem) => {
    try {
      await productListsApi.removeItem(item.id);
      setList((prev) => (prev ? { ...prev, items: prev.items.filter((it) => it.id !== item.id) } : prev));
    } catch (err) {
      notifications.show({
        title: 'Could not remove item',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!list) return;
    const target = index + dir;
    if (target < 0 || target >= list.items.length) return;
    const reordered = [...list.items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setList({ ...list, items: reordered });
    try {
      await productListsApi.reorderItems(list.id, reordered.map((it) => it.id));
    } catch (err) {
      notifications.show({
        title: 'Could not reorder',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
      load();
    }
  };

  const addItem = async () => {
    if (!list || !addSku) return;
    setAdding(true);
    try {
      const result = await productListsApi.addItem(list.id, {
        sku: addSku,
        isVariant: false,
        description: addDescription,
      });
      if (result.duplicate) {
        notifications.show({ title: 'Already on list', message: `${addSku} is already on this list.`, color: 'yellow' });
      } else {
        setAddSku(null);
        setAddDescription(null);
        load();
      }
    } catch (err) {
      notifications.show({
        title: 'Could not add item',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setAdding(false);
    }
  };

  const handleExport = async () => {
    if (!list) return;
    try {
      const res = await window.electron.invoke(IpcChannel.EXPORT_REPORT, {
        fileName: list.title.replace(/[^\w-]+/g, '_') || 'product-list',
        format: 'xlsx',
        sheetName: list.title.slice(0, 28) || 'List',
        columns: [
          { header: '#', key: 'index', format: 'number' },
          { header: 'Part Number', key: 'sku', format: 'text' },
          { header: 'Description', key: 'description', format: 'text' },
          { header: 'Note', key: 'note', format: 'text' },
        ],
        rows: list.items.map((it, i) => ({
          index: i + 1,
          sku: it.sku,
          description: it.description ?? '',
          note: it.note ?? '',
        })),
      });
      if (res?.success && res.data && !res.data.cancelled) {
        notifications.show({ title: 'Exported', message: 'List exported to Excel.', color: 'green' });
      } else if (!res?.success) {
        throw new Error(res?.error || 'Export failed');
      }
    } catch (err) {
      notifications.show({
        title: 'Could not export',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    }
  };

  if (loading) {
    return <Center py="xl"><Loader /></Center>;
  }

  if (!list) {
    return (
      <Stack gap="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => replaceCurrentTab('/lists')}>
          Back to lists
        </Button>
        <Text c="dimmed">List not found.</Text>
      </Stack>
    );
  }

  const statusMeta = STATUS_META[list.status] ?? STATUS_META.open;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group gap="sm" align="center">
          <ActionIcon variant="subtle" onClick={() => replaceCurrentTab('/lists')} aria-label="Back to lists">
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>{list.title}</Title>
          <Badge color={statusMeta.color} variant="light" size="lg">{statusMeta.label}</Badge>
        </Group>
        <Group gap="sm">
          <ActionIcon variant="subtle" size="lg" onClick={load} title="Refresh">
            <IconRefresh size={18} />
          </ActionIcon>
          <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => printProductList(list)}>
            Print
          </Button>
          {canExport && (
            <Button variant="light" leftSection={<IconFileExport size={16} />} onClick={handleExport}>
              Export
            </Button>
          )}
          {canManage && (
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <Button variant="light">Status</Button>
              </Menu.Target>
              <Menu.Dropdown>
                {list.status !== 'ordered' && (
                  <Menu.Item leftSection={<IconShoppingCart size={16} />} onClick={() => changeStatus('ordered')}>
                    Mark as ordered
                  </Menu.Item>
                )}
                {list.status !== 'archived' && (
                  <Menu.Item leftSection={<IconArchive size={16} />} onClick={() => changeStatus('archived')}>
                    Archive
                  </Menu.Item>
                )}
                {list.status !== 'open' && (
                  <Menu.Item leftSection={<IconRotate size={16} />} onClick={() => changeStatus('open')}>
                    Reopen
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      {/* Details */}
      <Paper withBorder radius="md" p="md">
        <Stack gap="sm">
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            disabled={!canManage}
          />
          <Textarea
            label="Note"
            placeholder="What is this list for?"
            autosize
            minRows={2}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            disabled={!canManage}
          />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              Created by {list.createdByName || 'Unknown'} · {formatDate(list.createdAt)}
              {list.orderedAt ? ` · Ordered ${formatDate(list.orderedAt)}` : ''}
            </Text>
            {canManage && (
              <Button
                size="xs"
                leftSection={<IconDeviceFloppy size={14} />}
                disabled={!headerDirty}
                loading={savingHeader}
                onClick={saveHeader}
              >
                Save details
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>

      {/* Add item */}
      {canManage && (
        <Paper withBorder radius="md" p="md">
          <Group align="flex-end" gap="sm">
            <div style={{ flex: 1 }}>
              <InventorySelect
                label="Add a part"
                value={addSku}
                onChange={(sku, item) => {
                  setAddSku(sku);
                  setAddDescription(item?.description1 ?? null);
                }}
              />
            </div>
            <Button onClick={addItem} loading={adding} disabled={!addSku}>
              Add
            </Button>
          </Group>
        </Paper>
      )}

      {/* Items */}
      <Paper withBorder radius="md" p={0}>
        <Divider label={`${list.items.length} item${list.items.length === 1 ? '' : 's'}`} labelPosition="center" my={0} py="sm" />
        {list.items.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No items yet. Add a part above, or use “Add to list” from Inventory.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm" horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 48 }}>#</Table.Th>
                  <Table.Th>Part</Table.Th>
                  <Table.Th>Note</Table.Th>
                  <Table.Th style={{ width: 120 }} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.items.map((item, index) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{index + 1}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text fw={500} size="sm">{item.sku}</Text>
                        {item.description && (
                          <Text size="xs" c="dimmed" lineClamp={1}>{item.description}</Text>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <TextInput
                        variant="unstyled"
                        placeholder="Add a note…"
                        value={itemNotes[item.id] ?? ''}
                        onChange={(e) => setItemNotes((prev) => ({ ...prev, [item.id]: e.currentTarget.value }))}
                        onBlur={() => saveItemNote(item)}
                        disabled={!canManage}
                      />
                    </Table.Td>
                    <Table.Td>
                      {canManage && (
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Move up">
                            <ActionIcon variant="subtle" color="gray" disabled={index === 0} onClick={() => move(index, -1)}>
                              <IconChevronUp size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Move down">
                            <ActionIcon
                              variant="subtle"
                              color="gray"
                              disabled={index === list.items.length - 1}
                              onClick={() => move(index, 1)}
                            >
                              <IconChevronDown size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Remove">
                            <ActionIcon variant="subtle" color="red" onClick={() => removeItem(item)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>
    </Stack>
  );
}
