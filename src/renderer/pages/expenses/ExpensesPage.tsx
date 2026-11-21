import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Badge,
  ActionIcon,
  Text,
  Button,
  Select,
  Switch,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
} from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column } from '../../components/common/DataTable';
import { PermissionGate, usePermissions } from '../../permissions';
import { useListState, useRestoreGuard, wasPersisted } from '../../hooks/useListState';
import { useBusinessExpenses } from '../../hooks/useBusinessExpenses';
import { ExpenseFormModal } from '../../components/expenses/ExpenseFormModal';
import { IpcChannel } from '../../../shared/types/ipc';
import type { BusinessExpense } from '../../../shared/types/businessExpense';

const formatCurrency = (value: string | number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    typeof value === 'number' ? value : parseFloat(value || '0'),
  );

export function ExpensesPage() {
  const { runWithPermission } = usePermissions();
  const { getExpenses, deleteExpense } = useBusinessExpenses();

  const [loading, setLoading] = useState(() => !wasPersisted('expenses:list'));
  const [expenses, setExpenses] = useListState<BusinessExpense[]>('expenses:list', []);
  const [total, setTotal] = useListState('expenses:total', 0);
  const [page, setPage] = useListState('expenses:page', 1);
  const [totalPages, setTotalPages] = useListState('expenses:totalPages', 1);
  const [search, setSearch] = useListState('expenses:search', '');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [category, setCategory] = useListState<string | null>('expenses:category', null);
  const [deductibleOnly, setDeductibleOnly] = useListState('expenses:deductibleOnly', false);
  const skipInitialFetch = useRestoreGuard('expenses:list');
  const skipInitialPageReset = useRestoreGuard('expenses:list');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null);

  const pageSize = 20;

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getExpenses({
        page,
        pageSize,
        search: debouncedSearch,
        category: category || undefined,
        isTaxDeductible: deductibleOnly ? true : undefined,
      });
      if (result.success && result.data) {
        setExpenses(result.data.data);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch business expenses:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, category, deductibleOnly, getExpenses, setExpenses, setTotal, setTotalPages]);

  useEffect(() => {
    if (skipInitialFetch()) return;
    fetchExpenses();
  }, [fetchExpenses, skipInitialFetch]);

  useEffect(() => {
    if (skipInitialPageReset()) return;
    setPage(1);
  }, [debouncedSearch, category, deductibleOnly, skipInitialPageReset, setPage]);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CATEGORIES_BY_TYPE, {
          categoryType: 'expense',
        });
        if (result.success && result.data) {
          setCategoryOptions(result.data.map((c: { category: string }) => c.category));
        }
      } catch (error) {
        console.error('Failed to load expense categories:', error);
      }
    })();
  }, []);

  const openCreateModal = () => {
    setEditingExpense(null);
    setModalOpen(true);
  };

  const openEditModal = (expense: BusinessExpense) => {
    setEditingExpense(expense);
    setModalOpen(true);
  };

  const handleDelete = useCallback(
    (expense: BusinessExpense) => {
      modals.openConfirmModal({
        title: 'Delete Expense',
        children: (
          <Text size="sm">
            Are you sure you want to delete the expense for <strong>{expense.payee}</strong>
            {' '}({formatCurrency(expense.total)})? This action cannot be undone.
          </Text>
        ),
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            const result = await deleteExpense(expense.id);
            if (result.success) {
              notifications.show({
                title: 'Expense Deleted',
                message: `Expense for ${expense.payee} has been deleted`,
                color: 'green',
              });
              fetchExpenses();
            } else {
              notifications.show({
                title: 'Error',
                message: result.error || 'Failed to delete expense',
                color: 'red',
              });
            }
          } catch (error) {
            notifications.show({
              title: 'Error',
              message: 'An unexpected error occurred',
              color: 'red',
            });
          }
        },
      });
    },
    [deleteExpense, fetchExpenses],
  );

  const requestDelete = useCallback(
    (expense: BusinessExpense) => {
      runWithPermission(
        {
          permissionCode: 'DELETE_BUSINESS_EXPENSE',
          actionLabel: `Delete expense for ${expense.payee}`,
          context: { entity: 'business_expense', id: expense.id },
        },
        () => handleDelete(expense),
      );
    },
    [runWithPermission, handleDelete],
  );

  const columns: Column<BusinessExpense>[] = useMemo(
    () => [
      {
        key: 'expenseDate',
        header: 'Date',
        width: 110,
        render: (e) => <Text size="sm">{e.expenseDate.slice(0, 10)}</Text>,
      },
      {
        key: 'payee',
        header: 'Payee',
        render: (e) => <Text fw={500}>{e.payee}</Text>,
      },
      {
        key: 'category',
        header: 'Category',
        render: (e) => (
          <Badge color="grape" variant="light" size="sm">
            {e.category}
          </Badge>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 110,
        render: (e) => <Text size="sm">{formatCurrency(e.amount)}</Text>,
      },
      {
        key: 'tax',
        header: 'Tax',
        width: 100,
        render: (e) => <Text size="sm">{formatCurrency(e.tax)}</Text>,
      },
      {
        key: 'total',
        header: 'Total',
        width: 110,
        render: (e) => <Text size="sm" fw={600}>{formatCurrency(e.total)}</Text>,
      },
      {
        key: 'isTaxDeductible',
        header: 'Deductible',
        width: 110,
        render: (e) => (
          <Badge color={e.isTaxDeductible ? 'green' : 'gray'} variant="light" size="sm">
            {e.isTaxDeductible ? 'Yes' : 'No'}
          </Badge>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 90,
        render: (e) => (
          <Group gap="xs">
            <ActionIcon variant="subtle" color="blue" onClick={() => openEditModal(e)} title="Edit">
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" onClick={() => requestDelete(e)} title="Delete">
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        ),
      },
    ],
    [requestDelete],
  );

  return (
    <PermissionGate permission="VIEW_BUSINESS_EXPENSES">
      <Stack p="xl" gap="lg">
        <Group justify="space-between" align="center">
          <Title order={2}>Business Expenses</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
            New Expense
          </Button>
        </Group>

        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Group gap="md">
              <TextInput
                placeholder="Search payee or description..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1 }}
              />
              <Select
                placeholder="All categories"
                data={categoryOptions}
                value={category}
                onChange={setCategory}
                clearable
                w={200}
              />
              <Switch
                label="Deductible only"
                checked={deductibleOnly}
                onChange={(e) => setDeductibleOnly(e.currentTarget.checked)}
              />
              <ActionIcon variant="subtle" onClick={fetchExpenses} title="Refresh">
                <IconRefresh size={18} />
              </ActionIcon>
            </Group>

            <Text size="sm" c="dimmed">
              {total} expense{total !== 1 ? 's' : ''} found
            </Text>

            <DataTable
              columns={columns}
              data={expenses}
              loading={loading}
              keyField="id"
              onRowClick={(e) => openEditModal(e)}
              emptyMessage="No business expenses recorded yet"
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              skeletonRows={5}
              stickyActionsColumn
            />
          </Stack>
        </Paper>
      </Stack>

      <ExpenseFormModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchExpenses}
        expense={editingExpense}
      />
    </PermissionGate>
  );
}
