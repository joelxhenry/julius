import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Alert,
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
  IconBarcode,
  IconRefresh,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { PrintButton } from '../../components/common';
import { usePermissions, RestrictedLink } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';

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
  transactionReference: string | null;
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
  const location = useLocation();
  const { user } = useAuth();
  const { openTab, updateTabTitle, replaceCurrentTab } = useTabContext();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processedByName, setProcessedByName] = useState<string | null>(null);

  const { runWithPermission } = usePermissions();

  // Void modal state
  const [voidModalOpen, { open: openVoidModal, close: closeVoidModal }] = useDisclosure(false);

  // Voiding a payment requires VOID_PAYMENT; otherwise another authorised user
  // approves it once (recorded) before the void modal opens.
  const requestVoid = useCallback(() => {
    runWithPermission(
      { permissionCode: 'VOID_PAYMENT', actionLabel: 'Void payment', context: { entity: 'payment' } },
      openVoidModal
    );
  }, [runWithPermission, openVoidModal]);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);
  const [isVoided, setIsVoided] = useState(false);

  // Fetch processed-by employee name
  useEffect(() => {
    if (!payment?.processedById) { setProcessedByName(null); return; }
    window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: payment.processedById }).then((res) => {
      if (res.success && res.data) {
        const emp = res.data;
        const name = employeeDisplayName(emp);
        setProcessedByName(name);
      }
    });
  }, [payment?.processedById]);

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
    setIsVoided(false);
    loadPayment();
  }, [loadPayment]);

  // Update tab title (only when this tab is active)
  useEffect(() => {
    if (payment && location.pathname === `/payments/${id}`) {
      updateTabTitle(location.pathname, `Payment #${payment.id}`);
    }
  }, [payment, id, location.pathname, updateTabTitle]);

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
        setIsVoided(true);
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

  const handleViewInvoice = useCallback(async () => {
    if (!payment?.invoiceNumber) return;
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, {
        invNumber: payment.invoiceNumber,
      });
      if (result.success && result.data) {
        openTab(`/invoices/${result.data.id}`);
      } else {
        notifications.show({
          title: 'Invoice Not Found',
          message: `Invoice ${payment.invoiceNumber} could not be found.`,
          color: 'red',
        });
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load invoice', color: 'red' });
    }
  }, [payment, openTab]);

  const handleViewCreditNote = useCallback(async () => {
    if (!payment?.creditNoteNumber) return;
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE_BY_NUMBER, {
        crNumber: payment.creditNoteNumber,
      });
      if (result.success && result.data) {
        openTab(`/credit-notes/${result.data.id}`);
      } else {
        notifications.show({
          title: 'Credit Note Not Found',
          message: `Credit note ${payment.creditNoteNumber} could not be found.`,
          color: 'red',
        });
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load credit note', color: 'red' });
    }
  }, [payment, openTab]);

  // For backwards-compat: primary document navigation
  const handleViewDocument = useCallback(async () => {
    if (!payment) return;
    if (payment.invoiceNumber) {
      handleViewInvoice();
    } else if (payment.creditNoteNumber) {
      handleViewCreditNote();
    }
  }, [payment, handleViewInvoice, handleViewCreditNote]);

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
          <Text c="dimmed">The payment you&apos;re looking for doesn&apos;t exist or has been deleted.</Text>
        </Stack>
        <Button leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/payments')}>
          Back to Payments
        </Button>
      </Stack>
    );
  }

  const amount = parseFloat(payment.amount);
  const isVoidEntry = isVoided || amount < 0 || payment.paymentDesc?.includes('VOID');

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => replaceCurrentTab('/payments')}
              title="Back to Payments"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
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
            <ActionIcon variant="subtle" size="lg" onClick={loadPayment} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
            <PrintButton documentType="payment_receipt" documentId={payment.id} />
            {canVoidPayment(payment) && (
              <Button
                color="red"
                variant="light"
                leftSection={<IconX size={16} />}
                onClick={requestVoid}
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
                      {payment.documentType === 'CREDIT' && payment.creditNoteNumber
                        ? <IconReceipt size={16} color="gray" />
                        : <IconCash size={16} color="gray" />}
                      <Text size="sm" c="dimmed">Payment Method</Text>
                    </Group>
                    <Text fw={500} ml={24}>
                      {payment.documentType === 'CREDIT' && payment.creditNoteNumber
                        ? 'Credit Note'
                        : payment.paymentDesc2 || payment.paymentDesc || '-'}
                    </Text>
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
                      {payment.documentType === 'CREDIT' && payment.invoiceNumber
                        ? 'Credit Applied to Invoice'
                        : payment.documentType}
                    </Badge>
                  </Grid.Col>

                  {/* Invoice link - shown for all payment types that have an invoice */}
                  {payment.invoiceNumber && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Invoice</Text>
                      <RestrictedLink permission="VIEW_INVOICES" fw={600} color="blue" mt={4} onClick={handleViewInvoice}>
                        {payment.invoiceNumber}
                      </RestrictedLink>
                    </Grid.Col>
                  )}

                  {/* Credit note link - shown when a credit note was the payment source */}
                  {payment.creditNoteNumber && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">Credit Note</Text>
                      <RestrictedLink permission="VIEW_CREDIT_NOTES" fw={600} color="teal" mt={4} onClick={handleViewCreditNote}>
                        {payment.creditNoteNumber}
                      </RestrictedLink>
                    </Grid.Col>
                  )}
                </Grid>

                {payment.transactionReference && (
                  <>
                    <Divider />
                    <Group gap="xs">
                      <IconBarcode size={16} color="gray" />
                      <Text fw={600}>Reference</Text>
                    </Group>
                    <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                      {payment.transactionReference}
                    </Text>
                  </>
                )}

                {/* Only show notes when they carry real content - not the
                    payment method code that older records duplicated here. */}
                {payment.paymentDesc && payment.paymentDesc !== payment.paymentDesc2 && (
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
                    <Text size="sm" fw={500}>{payment.currency || 'JMD'}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Created</Text>
                    <Text size="sm">{formatDateTime(payment.createdAt)}</Text>
                  </Group>
                  {payment.processedById && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">Processed By</Text>
                      <RestrictedLink
                        permission="VIEW_EMPLOYEES"
                        size="sm"
                        fw={500}
                        color="violet"
                        onClick={() => openTab(`/employees/${payment.processedById}`)}
                      >
                        {processedByName || `Employee #${payment.processedById}`}
                      </RestrictedLink>
                    </Group>
                  )}
                </Stack>
              </Stack>
            </Card>

            {/* Quick Actions */}
            <Card withBorder p="md" radius="md" mt="md">
              <Stack gap="sm">
                <Text fw={600}>Quick Actions</Text>

                {/* For credit note application payments - show both links */}
                {payment.documentType === 'CREDIT' && payment.invoiceNumber && payment.creditNoteNumber ? (
                  <>
                    <Button
                      fullWidth
                      variant="light"
                      color="blue"
                      leftSection={<IconFileInvoice size={16} />}
                      onClick={handleViewInvoice}
                    >
                      View Invoice {payment.invoiceNumber}
                    </Button>
                    <Button
                      fullWidth
                      variant="light"
                      color="teal"
                      leftSection={<IconReceipt size={16} />}
                      onClick={handleViewCreditNote}
                    >
                      View Credit Note {payment.creditNoteNumber}
                    </Button>
                  </>
                ) : (
                  <Button
                    fullWidth
                    variant="light"
                    leftSection={getDocumentTypeIcon(payment.documentType)}
                    onClick={handleViewDocument}
                  >
                    View {payment.documentType === 'INVOICE' ? 'Invoice' : payment.documentType === 'CREDIT' ? 'Credit Note' : 'Document'}
                  </Button>
                )}

                {canVoidPayment(payment) && (
                  <Button
                    fullWidth
                    variant="light"
                    color="red"
                    leftSection={<IconX size={16} />}
                    onClick={requestVoid}
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
              <Text size="sm" c="dimmed">Method</Text>
              <Text size="sm">
                {payment.documentType === 'CREDIT' && payment.creditNoteNumber
                  ? `Credit Note ${payment.creditNoteNumber}`
                  : payment.paymentDesc2 || payment.paymentDesc || '-'}
              </Text>
            </Group>
          </Stack>

          {payment.documentType === 'CREDIT' && payment.creditNoteNumber && (
            <Alert icon={<IconReceipt size={16} />} color="teal" variant="light">
              <Text size="sm">
                Voiding this payment will restore{' '}
                <Text span fw={600}>{formatCurrency(payment.amount)}</Text>{' '}
                back to credit note{' '}
                <Text span fw={600}>{payment.creditNoteNumber}</Text>.
              </Text>
            </Alert>
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
    </>
  );
}
