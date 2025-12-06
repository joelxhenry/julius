import { useState, useEffect, useCallback, useMemo } from 'react';
import { Paper, Stack, Text, Group, Badge, ThemeIcon, ActionIcon, Menu, Modal, Textarea, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCash, IconReceipt, IconDotsVertical, IconX } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { DataTable, Column } from '../common/DataTable';

interface Payment {
  id: number;
  documentType: string;
  documentNumber: string;
  invoiceNumber: string | null;
  payerName: string | null;
  paymentDate: string | null;
  paymentDesc: string | null;
  paymentDesc2: string | null;
  amount: string;
  processedById: number | null;
  createdAt: string;
}

interface PaymentHistoryCardProps {
  invoiceNumber: string;
  invoiceTotal: number;
  totalPaid: number;
  onPaymentVoided?: () => void;
}

const formatCurrency = (value: string | number) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function PaymentHistoryCard({ invoiceNumber, invoiceTotal, totalPaid, onPaymentVoided }: PaymentHistoryCardProps) {
  const { user } = useAuth();
  const { openTab } = useTabContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [voidModalOpen, { open: openVoidModal, close: closeVoidModal }] = useDisclosure(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_BY_INVOICE, {
        invoiceNumber,
      });
      if (result.success && result.data) {
        setPayments(result.data);
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [invoiceNumber]);

  useEffect(() => {
    if (invoiceNumber) {
      loadPayments();
    }
  }, [invoiceNumber, loadPayments]);

  const handleVoidClick = useCallback((payment: Payment) => {
    setSelectedPayment(payment);
    setVoidReason('');
    openVoidModal();
  }, [openVoidModal]);

  const handleVoidConfirm = useCallback(async () => {
    if (!selectedPayment || !user) return;

    if (!voidReason.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please provide a reason for voiding this payment',
        color: 'red',
      });
      return;
    }

    setIsVoiding(true);
    try {
      const result = await window.electron.invoke(IpcChannel.VOID_PAYMENT, {
        paymentId: selectedPayment.id,
        voidedById: user.id,
        voidReason: voidReason.trim(),
      });

      if (result.success) {
        notifications.show({
          title: 'Payment Voided',
          message: `Payment of ${formatCurrency(selectedPayment.amount)} has been voided`,
          color: 'green',
        });
        closeVoidModal();
        loadPayments();
        onPaymentVoided?.();
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to void payment',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to void payment',
        color: 'red',
      });
    } finally {
      setIsVoiding(false);
    }
  }, [selectedPayment, user, voidReason, closeVoidModal, loadPayments, onPaymentVoided]);

  const balanceDue = invoiceTotal - totalPaid;

  // Check if a payment can be voided (not already a void entry, positive amount)
  const canVoidPayment = (payment: Payment) => {
    const amount = parseFloat(payment.amount);
    const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');
    return !isVoidEntry && amount > 0;
  };

  // Define columns for DataTable
  const columns: Column<Payment>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      width: 100,
      render: (payment) => (
        <Text size="sm">{formatDate(payment.paymentDate)}</Text>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      render: (payment) => {
        const amount = parseFloat(payment.amount);
        const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');
        return (
          <Group gap={4}>
            <Text size="sm">
              {payment.paymentDesc2 || payment.paymentDesc || '-'}
            </Text>
            {isVoidEntry && <Badge size="xs" color="red" variant="light">VOID</Badge>}
          </Group>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 100,
      render: (payment) => {
        const amount = parseFloat(payment.amount);
        const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');
        return (
          <Text
            size="sm"
            fw={500}
            c={isVoidEntry ? 'red' : 'green'}
            ta="right"
          >
            {isVoidEntry ? '-' : '+'}{formatCurrency(Math.abs(amount))}
          </Text>
        );
      },
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (payment) => (
        <Text size="sm" c="dimmed" truncate maw={120}>
          {payment.paymentDesc || '-'}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 40,
      render: (payment) => {
        if (!canVoidPayment(payment)) return null;
        return (
          <Menu shadow="md" width={150} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" color="gray">
                <IconDotsVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconX size={14} />}
                color="red"
                onClick={() => handleVoidClick(payment)}
              >
                Void Payment
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        );
      },
    },
  ], [handleVoidClick]);

  return (
    <div>
      <Stack gap="md">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon variant="light" color="green" size="sm">
              <IconCash size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Payment History</Text>
          </Group>
          <Badge
            color={balanceDue <= 0 ? 'green' : 'orange'}
            variant="light"
          >
            {balanceDue <= 0 ? 'Paid in Full' : `${formatCurrency(balanceDue)} Due`}
          </Badge>
        </Group>

        {payments.length === 0 && !isLoading ? (
          <Stack align="center" py="lg" gap="xs">
            <ThemeIcon variant="light" color="gray" size="lg" radius="xl">
              <IconReceipt size={18} />
            </ThemeIcon>
            <Text size="sm" c="dimmed">No payments recorded</Text>
          </Stack>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={payments}
              loading={isLoading}
              keyField="id"
              emptyMessage="No payments recorded"
              minWidth={400}
              skeletonRows={3}
              stickyActionsColumn
              onRowClick={(payment) => {
                openTab(`/payments/${payment.id}`);
              }}
            />

            {payments.length > 0 && (
              <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                <Text size="sm" c="dimmed">
                  Total Paid: <Text span fw={600} c="green">{formatCurrency(totalPaid)}</Text>
                </Text>
                <Text size="sm" c="dimmed">
                  Invoice Total: <Text span fw={500}>{formatCurrency(invoiceTotal)}</Text>
                </Text>
              </Group>
            )}
          </>
        )}
      </Stack>

      {/* Void Payment Modal */}
      <Modal
        opened={voidModalOpen}
        onClose={closeVoidModal}
        title={
          <Group gap="xs">
            <IconX size={20} color="var(--mantine-color-red-6)" />
            <Text fw={600}>Void Payment</Text>
          </Group>
        }
        centered
        size="sm"
      >
        <Stack gap="md">
          {selectedPayment && (
            <Stack gap={4} p="sm" style={{ backgroundColor: 'var(--mantine-color-red-light)', borderRadius: 'var(--mantine-radius-sm)' }}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Amount</Text>
                <Text size="sm" fw={500}>{formatCurrency(selectedPayment.amount)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Date</Text>
                <Text size="sm">{formatDate(selectedPayment.paymentDate)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Method</Text>
                <Text size="sm">{selectedPayment.paymentDesc2 || selectedPayment.paymentDesc || '-'}</Text>
              </Group>
            </Stack>
          )}

          <Text size="sm" c="dimmed">
            This will reverse the payment and restore the invoice balance. This action cannot be undone.
          </Text>

          <Textarea
            label="Reason for voiding"
            placeholder="Enter the reason for voiding this payment..."
            value={voidReason}
            onChange={(e) => setVoidReason(e.currentTarget.value)}
            minRows={2}
            required
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={closeVoidModal} disabled={isVoiding}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleVoidConfirm}
              loading={isVoiding}
              disabled={!voidReason.trim()}
            >
              Void Payment
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
