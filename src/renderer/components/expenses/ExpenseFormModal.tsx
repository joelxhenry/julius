import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Autocomplete,
  Switch,
  Alert,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconReceipt2, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useActionConfirm } from '../../permissions';
import { useBusinessExpenses } from '../../hooks/useBusinessExpenses';
import type { BusinessExpense } from '../../../shared/types/businessExpense';

interface ExpenseFormModalProps {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  expense: BusinessExpense | null; // null => create mode
}

const PAYMENT_METHOD_OPTIONS = ['Cash', 'Bank Transfer', 'Card', 'Cheque', 'Other'];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ExpenseFormModal({ opened, onClose, onSaved, expense }: ExpenseFormModalProps) {
  const { confirmAction } = useActionConfirm();
  const { createExpense, updateExpense } = useBusinessExpenses();
  const isEdit = !!expense;

  const [expenseDate, setExpenseDate] = useState<string | null>(todayDateString());
  const [payee, setPayee] = useState('');
  const [category, setCategory] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | string>('');
  const [tax, setTax] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [isTaxDeductible, setIsTaxDeductible] = useState(true);
  const [referenceNo, setReferenceNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load expense-category suggestions whenever the modal opens.
  useEffect(() => {
    if (!opened) return;
    (async () => {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CATEGORIES_BY_TYPE, {
          categoryType: 'expense',
        });
        if (result.success && result.data) {
          setCategoryOptions(result.data.map((c: { category: string }) => c.category));
        }
      } catch (err) {
        console.error('Failed to load expense categories:', err);
      }
    })();
  }, [opened]);

  // Reset/populate the form when the modal opens or the target expense changes.
  useEffect(() => {
    if (!opened) return;
    if (expense) {
      setExpenseDate(expense.expenseDate.slice(0, 10));
      setPayee(expense.payee);
      setCategory(expense.category);
      setDescription(expense.description ?? '');
      setAmount(parseFloat(expense.amount));
      setTax(parseFloat(expense.tax));
      setPaymentMethod(expense.paymentMethod);
      setIsTaxDeductible(expense.isTaxDeductible);
      setReferenceNo(expense.referenceNo ?? '');
    } else {
      setExpenseDate(todayDateString());
      setPayee('');
      setCategory('');
      setDescription('');
      setAmount('');
      setTax('');
      setPaymentMethod(null);
      setIsTaxDeductible(true);
      setReferenceNo('');
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, expense?.id]);

  const amountValue = typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;
  const taxValue = typeof tax === 'number' ? tax : parseFloat(tax as string) || 0;
  const total = amountValue + taxValue;

  const handleSubmit = async () => {
    if (!expenseDate) {
      setError('Please select the expense date');
      return;
    }
    if (!payee.trim()) {
      setError('Please enter a payee');
      return;
    }
    if (!category.trim()) {
      setError('Please select or enter a category');
      return;
    }
    if (amountValue <= 0) {
      setError('Please enter an amount greater than zero');
      return;
    }

    // Recording an expense affects financial/tax records: require an access code,
    // same as invoices/payments/quotations.
    const actor = await confirmAction({
      permissionCode: isEdit ? 'EDIT_BUSINESS_EXPENSE' : 'CREATE_BUSINESS_EXPENSE',
      actionLabel: `${isEdit ? 'Edit' : 'Record'} expense for ${payee.trim()}`,
      context: { entity: 'business_expense', amount: amountValue, category: category.trim() },
    });
    if (!actor) return;

    setIsLoading(true);
    setError(null);

    try {
      // If this category doesn't exist yet under the 'expense' type, create it so
      // it becomes a suggestion next time.
      if (!categoryOptions.includes(category.trim())) {
        await window.electron.invoke(IpcChannel.CREATE_CATEGORY, {
          category: category.trim(),
          categoryType: 'expense',
        });
      }

      const payload = {
        expenseDate,
        payee: payee.trim(),
        category: category.trim(),
        description: description.trim() || null,
        amount: amountValue.toFixed(2),
        tax: taxValue.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: paymentMethod || null,
        isTaxDeductible,
        referenceNo: referenceNo.trim() || null,
        ...(isEdit ? {} : { authorizedById: actor.employeeId }),
      };

      const result = expense
        ? await updateExpense(expense.id, payload)
        : await createExpense(payload);

      if (result.success) {
        notifications.show({
          title: isEdit ? 'Expense Updated' : 'Expense Recorded',
          message: `${formatCurrency(total)} for ${payee.trim()}`,
          color: 'green',
        });
        onSaved();
        onClose();
      } else {
        setError(result.error || 'Failed to save expense');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconReceipt2 size={20} />
          <Text fw={600}>{isEdit ? 'Edit Expense' : 'New Expense'}</Text>
        </Group>
      }
      centered
      size="lg"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group grow>
          <DateInput
            label="Expense Date"
            value={expenseDate}
            onChange={setExpenseDate}
            disabled={isLoading}
            required
          />
          <TextInput
            label="Payee"
            placeholder="e.g. JPS, landlord, supplier"
            value={payee}
            onChange={(e) => setPayee(e.currentTarget.value)}
            disabled={isLoading}
            required
          />
        </Group>

        <Autocomplete
          label="Category"
          placeholder="Select or type a new category"
          data={categoryOptions}
          value={category}
          onChange={setCategory}
          disabled={isLoading}
          required
        />

        <Textarea
          label="Description (optional)"
          placeholder="What was this expense for?"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
          disabled={isLoading}
        />

        <Group grow>
          <NumberInput
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
            min={0}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            thousandSeparator=","
            disabled={isLoading}
            required
          />
          <NumberInput
            label="Tax Paid"
            placeholder="0.00"
            value={tax}
            onChange={setTax}
            min={0}
            decimalScale={2}
            fixedDecimalScale
            prefix="$"
            thousandSeparator=","
            disabled={isLoading}
          />
        </Group>

        <Group justify="space-between" p="sm" style={{ backgroundColor: 'var(--mantine-color-gray-light)', borderRadius: 'var(--mantine-radius-sm)' }}>
          <Text size="sm" fw={500}>Total</Text>
          <Text size="sm" fw={600}>{formatCurrency(total)}</Text>
        </Group>

        <Divider />

        <Group grow>
          <Select
            label="Payment Method"
            placeholder="Select payment method"
            data={PAYMENT_METHOD_OPTIONS}
            value={paymentMethod}
            onChange={setPaymentMethod}
            clearable
            disabled={isLoading}
          />
          <TextInput
            label="Reference # (optional)"
            placeholder="Cheque #, receipt #"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.currentTarget.value)}
            disabled={isLoading}
          />
        </Group>

        <Switch
          label="Tax deductible"
          checked={isTaxDeductible}
          onChange={(e) => setIsTaxDeductible(e.currentTarget.checked)}
          disabled={isLoading}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isLoading}>
            {isEdit ? 'Save Changes' : 'Record Expense'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
