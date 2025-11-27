import { Modal, Stack, Group, Button, Select, Textarea, Text } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { CurrencyInput } from '../common/CurrencyInput';
import { paymentSchema, type PaymentFormData } from '../../utils/schemas';
import numeral from 'numeral';

interface PaymentModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  invoiceId: number;
  balance: number;
  loading?: boolean;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CARD', label: 'Credit/Debit Card' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER', label: 'Other' },
];

export function PaymentModal({
  opened,
  onClose,
  onSubmit,
  invoiceId,
  balance,
  loading = false,
}: PaymentModalProps) {
  const form = useForm<PaymentFormData>({
    validate: zodResolver(paymentSchema),
    initialValues: {
      invoiceId,
      amount: balance,
      method: 'CASH',
      reference: '',
      notes: '',
    },
  });

  const handleSubmit = async (values: PaymentFormData) => {
    try {
      await onSubmit(values);
      notifications.show({
        title: 'Success',
        message: 'Payment recorded successfully',
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to record payment',
        color: 'red',
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Record Payment"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <Text size="sm" c="dimmed">
            Outstanding Balance: <strong>{numeral(balance).format('$0,0.00')}</strong>
          </Text>

          <CurrencyInput
            label="Payment Amount"
            placeholder="0.00"
            required
            {...form.getInputProps('amount')}
          />

          <Select
            label="Payment Method"
            data={PAYMENT_METHODS}
            required
            {...form.getInputProps('method')}
          />

          <Textarea
            label="Reference"
            placeholder="Cheque number, transaction ID, etc."
            {...form.getInputProps('reference')}
          />

          <Textarea
            label="Notes"
            placeholder="Additional notes"
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Record Payment
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
