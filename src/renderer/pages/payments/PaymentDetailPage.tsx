import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Badge,
  Loader,
  Center,
  Grid,
  Button,
  ActionIcon,
  Modal,
  Textarea,
  Card,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconCash,
  IconFileInvoice,
  IconReceipt,
  IconX,
  IconUser,
  IconCalendar,
  IconHash,
  IconNotes,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';

interface Payment {
  id: number;
  documentType: string;
  documentNumber: string;
  invoiceNumber: string | null;
  creditNoteNumber: string | null;
  billNumber: string | null;
  payerName: string | null;
  paymentDate: string | null;
  paymentDesc: string | null;
  paymentDesc2: string | null;
  amount: string;
  currency: string | null;
  processedById: number | null;
  createdAt: string;
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
    month: 'long',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function PaymentDetailPage() {
  const { id } = useTabParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openTab, updateTabTitle } = useTabContext();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Void modal state
  const [voidModalOpen, { open: openVoidModal, close: closeVoidModal }] = useDisclosure(false);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const loadPayment = useCallback(async () => {
    if (!id) {
      console.error('PaymentDetailPage: No ID provided');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('PaymentDetailPage: Loading payment with ID:', id);
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENT, { id: parseInt(id, 10) });
      console.log('PaymentDetailPage: Result:', result);

      if (result.success && result.data) {
        setPayment(result.data);
      } else {
        console.error('PaymentDetailPage: Payment not found or error:', result.error);
        notifications.show({
          title: 'Error',
          message: result.error || 'Payment not found',
          color: 'red',
        });
        // Don't navigate away immediately, let the user see the error state
      }
    } catch (error) {
      console.error('PaymentDetailPage: Failed to load payment:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load payment',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  // Update tab title
  useEffect(() => {
    if (payment) {
      updateTabTitle(`/payments/${id}`, `Payment #${payment.id}`);
    }
  }, [payment, id, updateTabTitle]);

  const handleVoidConfirm = useCallback(async () => {
    if (!payment || !user) return;

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
        paymentId: payment.id,
        voidedById: user.id,
        voidReason: voidReason.trim(),
      });

      if (result.success) {
        notifications.show({
          title: 'Payment Voided',
          message: `Payment of ${formatCurrency(payment.amount)} has been voided`,
          color: 'green',
        });
        closeVoidModal();
        loadPayment(); // Reload to show updated state
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
  }, [payment, user, voidReason, closeVoidModal, loadPayment]);

  const canVoidPayment = (p: Payment) => {
    const amount = parseFloat(p.amount);
    const isVoidEntry = amount < 0 || p.paymentDesc?.includes('VOID');
    return !isVoidEntry && amount > 0;
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return <IconFileInvoice size={20} />;
      case 'CREDIT':
        return <IconReceipt size={20} />;
      default:
        return <IconCash size={20} />;
    }
  };

  const getDocumentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      INVOICE: 'blue',
      CREDIT: 'green',
      BILL: 'orange',
    };
    return colors[type] || 'gray';
  };

  const handleViewDocument = useCallback(async () => {
    if (!payment) return;

    if (payment.documentType === 'INVOICE' && payment.invoiceNumber) {
      // Get invoice by number to find the ID
      try {
        console.log('Looking up invoice with number:', payment.invoiceNumber);
        const result = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, {
          invNumber: payment.invoiceNumber
        });
        console.log('Invoice lookup result:', result);

        if (result.success && result.data) {
          openTab(`/invoices/${result.data.id}`);
        } else {
          console.error('Invoice not found for number:', payment.invoiceNumber);
          notifications.show({
            title: 'Invoice Not Found',
            message: `Invoice ${payment.invoiceNumber} could not be found. It may have been deleted or archived.`,
            color: 'red',
          });
        }
      } catch (error) {
        console.error('Failed to find invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
          color: 'red',
        });
      }
    } else if (payment.documentType === 'CREDIT' && payment.creditNoteNumber) {
      // Get credit note by number to find the ID
      try {
        console.log('Looking up credit note with number:', payment.creditNoteNumber);
        const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE_BY_NUMBER, {
          crNumber: payment.creditNoteNumber
        });
        console.log('Credit note lookup result:', result);

        if (result.success && result.data) {
          openTab(`/credit-notes/${result.data.id}`);
        } else {
          console.error('Credit note not found for number:', payment.creditNoteNumber);
          notifications.show({
            title: 'Credit Note Not Found',
            message: `Credit note ${payment.creditNoteNumber} could not be found. It may have been deleted or archived.`,
            color: 'red',
          });
        }
      } catch (error) {
        console.error('Failed to find credit note:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load credit note',
          color: 'red',
        });
      }
    } else {
      // Handle case where document number is missing
      console.warn('Cannot view document - missing document number:', payment);
      notifications.show({
        title: 'Cannot View Document',
        message: 'This payment does not have an associated document number.',
        color: 'orange',
      });
    }
  }, [payment, openTab]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!payment) {
    return (
      <Stack p="xl" gap="lg" align="center" justify="center" h="60vh">
        <IconX size={48} color="var(--mantine-color-red-6)" />
        <Stack gap="xs" align="center">
          <Title order={3}>Payment Not Found</Title>
          <Text c="dimmed">The payment you're looking for doesn't exist or has been deleted.</Text>
        </Stack>
        <Button leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/payments')}>
          Back to Payments
        </Button>
      </Stack>
    );
  }

  const amount = parseFloat(payment.amount);
  const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Stack gap={4}>
              <Group gap="sm">
                <Title order={2}>Payment #{payment.id}</Title>
                <Badge
                  color={isVoidEntry ? 'red' : getDocumentTypeColor(payment.documentType)}
                  variant="light"
                  size="lg"
                  leftSection={getDocumentTypeIcon(payment.documentType)}
                >
                  {isVoidEntry ? 'VOIDED' : payment.documentType}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Recorded {formatDateTime(payment.createdAt)}
              </Text>
            </Stack>
          </Group>

          <Group gap="sm">
            {canVoidPayment(payment) && (
              <Button
                color="red"
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={openVoidModal}
              >
                Void Payment
              </Button>
            )}
          </Group>
        </Group>

        <Grid>
          {/* Main Details */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Payment Details</Text>

                <Grid>
                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <IconHash size={16} color="gray" />
                      <Text size="sm" c="dimmed">Payment ID</Text>
                    </Group>
                    <Text fw={500} ml={24}>{payment.id}</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <IconCalendar size={16} color="gray" />
                      <Text size="sm" c="dimmed">Payment Date</Text>
                    </Group>
                    <Text fw={500} ml={24}>{formatDate(payment.paymentDate)}</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <IconUser size={16} color="gray" />
                      <Text size="sm" c="dimmed">Payer</Text>
                    </Group>
                    <Text fw={500} ml={24}>{payment.payerName || '-'}</Text>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Group gap="xs">
                      <IconCash size={16} color="gray" />
                      <Text size="sm" c="dimmed">Payment Method</Text>
                    </Group>
                    <Text fw={500} ml={24}>{payment.paymentDesc2 || payment.paymentDesc || '-'}</Text>
                  </Grid.Col>
                </Grid>

                <Divider />

                <Text fw={600}>Document Information</Text>

                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Document Type</Text>
                    <Badge
                      color={getDocumentTypeColor(payment.documentType)}
                      variant="light"
                      mt={4}
                    >
                      {payment.documentType}
                    </Badge>
                  </Grid.Col>

                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">Document Number</Text>
                    <Group gap="xs" mt={4}>
                      <Text
                        fw={500}
                        c="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={handleViewDocument}
                      >
                        {payment.documentNumber}
                      </Text>
                    </Group>
                  </Grid.Col>

                  {payment.invoiceNumber && payment.invoiceNumber !== payment.documentNumber && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Invoice Number</Text>
                      <Text fw={500}>{payment.invoiceNumber}</Text>
                    </Grid.Col>
                  )}

                  {payment.creditNoteNumber && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Credit Note</Text>
                      <Text fw={500}>{payment.creditNoteNumber}</Text>
                    </Grid.Col>
                  )}
                </Grid>

                {payment.paymentDesc && (
                  <>
                    <Divider />
                    <Group gap="xs">
                      <IconNotes size={16} color="gray" />
                      <Text fw={600}>Notes</Text>
                    </Group>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                      {payment.paymentDesc}
                    </Text>
                  </>
                )}
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Amount Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Amount</Text>

                <Stack gap="xs" align="center" py="md">
                  <Text
                    size="xl"
                    fw={700}
                    c={isVoidEntry ? 'red' : 'green'}
                  >
                    {isVoidEntry ? '-' : '+'}{formatCurrency(Math.abs(amount))}
                  </Text>
                  {isVoidEntry && (
                    <Badge color="red" variant="light" size="lg">
                      VOIDED
                    </Badge>
                  )}
                </Stack>

                <Divider />

                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Currency</Text>
                    <Text size="sm" fw={500}>{payment.currency || 'USD'}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Created</Text>
                    <Text size="sm">{formatDateTime(payment.createdAt)}</Text>
                  </Group>
                  {payment.processedById && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Processed By</Text>
                      <Text size="sm">Employee #{payment.processedById}</Text>
                    </Group>
                  )}
                </Stack>
              </Stack>
            </Card>

            {/* Quick Actions */}
            <Card withBorder p="md" radius="md" mt="md">
              <Stack gap="sm">
                <Text fw={600}>Quick Actions</Text>

                <Button
                  fullWidth
                  variant="light"
                  leftSection={getDocumentTypeIcon(payment.documentType)}
                  onClick={handleViewDocument}
                >
                  View {payment.documentType === 'INVOICE' ? 'Invoice' : payment.documentType === 'CREDIT' ? 'Credit Note' : 'Document'}
                </Button>

                {canVoidPayment(payment) && (
                  <Button
                    fullWidth
                    variant="light"
                    color="red"
                    leftSection={<IconX size={16} />}
                    onClick={openVoidModal}
                  >
                    Void Payment
                  </Button>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
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
          <Stack gap={4} p="sm" style={{ backgroundColor: 'var(--mantine-color-red-light)', borderRadius: 'var(--mantine-radius-sm)' }}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Amount</Text>
              <Text size="sm" fw={500}>{formatCurrency(payment.amount)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Date</Text>
              <Text size="sm">{formatDate(payment.paymentDate)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Document</Text>
              <Text size="sm">{payment.documentNumber}</Text>
            </Group>
          </Stack>

          <Text size="sm" c="dimmed">
            This will reverse the payment and restore the document balance. This action cannot be undone.
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
    </>
  );
}
