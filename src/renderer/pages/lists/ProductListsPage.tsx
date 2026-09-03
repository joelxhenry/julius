import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Button,
  Badge,
  SegmentedControl,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconClipboardList } from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { NewListModal } from '../../components/lists';
import { usePermissions } from '../../permissions';
import { productListsApi } from '../../hooks/useProductLists';
import type {
  ProductListStatus,
  ProductListWithCount,
} from '../../../shared/types/productList';

const STATUS_META: Record<ProductListStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'blue' },
  ordered: { label: 'Ordered', color: 'green' },
  archived: { label: 'Archived', color: 'gray' },
};

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function ProductListsPage() {
  const { replaceCurrentTab } = useTabContext();
  const { can } = usePermissions();
  const [filter, setFilter] = useState<'all' | ProductListStatus>('all');
  const [lists, setLists] = useState<ProductListWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpened, { open: openNew, close: closeNew }] = useDisclosure(false);

  const canManage = can('MANAGE_PRODUCT_LISTS');
  const canDelete = can('DELETE_PRODUCT_LIST');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await productListsApi.list(filter === 'all' ? undefined : filter);
      setLists(data);
    } catch (err) {
      notifications.show({
        title: 'Could not load lists',
        message: err instanceof Error ? err.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openList = useCallback(
    (list: ProductListWithCount) => {
      replaceCurrentTab(`/lists/${list.id}`, { fromListing: true });
    },
    [replaceCurrentTab]
  );

  const handleDelete = useCallback(
    (list: ProductListWithCount) => {
      modals.openConfirmModal({
        title: 'Delete list',
        children: (
          <Text size="sm">
            Delete <Text span fw={600}>{list.title}</Text> and all its items? This cannot be undone.
          </Text>
        ),
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            await productListsApi.remove(list.id);
            notifications.show({ title: 'List deleted', message: `"${list.title}" deleted.`, color: 'green' });
            load();
          } catch (err) {
            notifications.show({
              title: 'Could not delete list',
              message: err instanceof Error ? err.message : 'Unknown error.',
              color: 'red',
            });
          }
        },
      });
    },
    [load]
  );

  const columns: Column<ProductListWithCount>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Title',
        render: (list) => (
          <Stack gap={2}>
            <Text fw={500} size="sm">{list.title}</Text>
            {list.note && (
              <Text size="xs" c="dimmed" lineClamp={1}>{list.note}</Text>
            )}
          </Stack>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: 120,
        render: (list) => {
          const meta = STATUS_META[list.status] ?? STATUS_META.open;
          return <Badge color={meta.color} variant="light">{meta.label}</Badge>;
        },
      },
      {
        key: 'itemCount',
        header: 'Items',
        width: 90,
        render: (list) => <Text size="sm">{list.itemCount}</Text>,
      },
      {
        key: 'createdByName',
        header: 'Created by',
        width: 180,
        render: (list) => (
          <Text size="sm" c={list.createdByName ? undefined : 'dimmed'}>
            {list.createdByName || '-'}
          </Text>
        ),
      },
      {
        key: 'createdAt',
        header: 'Created',
        width: 140,
        render: (list) => <Text size="sm">{formatDate(list.createdAt)}</Text>,
      },
      {
        key: 'actions',
        header: '',
        width: 60,
        render: (list) =>
          canDelete ? (
            <Group justify="flex-end" gap="xs">
              <Tooltip label="Delete">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(list);
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ) : null,
      },
    ],
    [canDelete, handleDelete]
  );

  return (
    <>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <IconClipboardList size={26} />
              <Title order={2}>Product Lists</Title>
            </Group>
            <Text c="dimmed" size="sm">
              Reorder lists. Collect parts that need ordering, then export and mark them ordered.
            </Text>
          </Stack>
          {canManage && (
            <Button leftSection={<IconPlus size={16} />} onClick={openNew}>
              New list
            </Button>
          )}
        </Group>

        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as 'all' | ProductListStatus)}
          data={[
            { label: 'All', value: 'all' },
            { label: 'Open', value: 'open' },
            { label: 'Ordered', value: 'ordered' },
            { label: 'Archived', value: 'archived' },
          ]}
        />

        <DataTable
          columns={columns}
          data={lists}
          loading={loading}
          keyField="id"
          onRowClick={openList}
          emptyMessage="No lists yet. Add a product to a list from Inventory, or create one here."
        />
      </Stack>

      <NewListModal
        opened={newOpened}
        onClose={closeNew}
        onCreated={(list) => replaceCurrentTab(`/lists/${list.id}`, { fromListing: true })}
      />
    </>
  );
}
