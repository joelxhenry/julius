import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  TextInput,
  Select,
  Badge,
  ActionIcon,
  Menu,
  Modal,
  Textarea,
  Button,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconCash, IconDotsVertical, IconX, IconFileInvoice, IconReceipt } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { DataTable, Column } from '../../components/common/DataTable';

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
  processedById: number | null;
  createdAt: string;
}

interface PaginatedResult {
  data: Payment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export function PaymentsPage() {
  const { user } = useAuth();
  const { openTab } = useTabContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Void modal state
  const [voidModalOpen, { open: openVoidModal, close: closeVoidModal }] = useDisclosure(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, {
        page,
        pageSize: 25,
        search: search || undefined,
        documentType: documentType || undefined,
      });

      if (result.success && result.data) {
        const paginatedData = result.data as PaginatedResult;
        setPayments(paginatedData.data);
        setTotalPages(paginatedData.totalPages);
        setTotal(paginatedData.total);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load payments',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, documentType]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, documentType]);

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
  }, [selectedPayment, user, voidReason, closeVoidModal, loadPayments]);

  const canVoidPayment = (payment: Payment) => {
    const amount = parseFloat(payment.amount);
    const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');
    return !isVoidEntry && amount > 0;
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return <IconFileInvoice size={14} />;
      case 'CREDIT':
        return <IconReceipt size={14} />;
      default:
        return <IconCash size={14} />;
    }
  };

  const getDocumentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      INVOICE: 'blue',
      CREDIT: 'green',
      BILL: 'orange',
    };
    return (
      <Badge size="xs" color={colors[type] || 'gray'} variant="light" leftSection={getDocumentTypeIcon(type)}>
        {type}
      </Badge>
    );
  };

  const handleViewPayment = useCallback((payment: Payment) => {
    openTab(`/payments/${payment.id}`);
  }, [openTab]);

  const handleViewDocument = useCallback(async (payment: Payment) => {
    if (payment.documentType === 'INVOICE' && payment.invoiceNumber) {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, {
          invNumber: payment.invoiceNumber
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
      } catch (error) {
        console.error('Failed to find invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
          color: 'red',
        });
      }
    } else if (payment.documentType === 'CREDIT' && payment.creditNoteNumber) {
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE_BY_NUMBER, {
          crNumber: payment.creditNoteNumber
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
      } catch (error) {
        console.error('Failed to find credit note:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load credit note',
          color: 'red',
        });
      }
    }
  }, [openTab]);

  // Define columns for DataTable
  const columns: Column<Payment>[] = useMemo(
    () => [
      {
        key: 'paymentDate',
        header: 'Date',
        width: 120,
        render: (payment) => <Text size="sm">{formatDate(payment.paymentDate)}</Text>,
      },
      {
        key: 'documentType',
        header: 'Type',
        width: 110,
        render: (payment) => getDocumentTypeBadge(payment.documentType),
      },
      {
        key: 'documentNumber',
        header: 'Document',
        width: 150,
        render: (payment) => {
          const amount = parseFloat(payment.amount);
          const isVoidEntry = amount < 0 || payment.paymentDesc?.includes('VOID');

          return (
            <Group gap={4}>
              <Text
                size="sm"
                fw={500}
                c="blue"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDocument(payment);
                }}
                style={{ cursor: 'pointer' }}
              >
                {payment.documentNumber}
              </Text>
              {isVoidEntry && (
                <Badge size="xs" color="red" variant="light">VOID</Badge>
              )}
            </Group>
          );
        },
      },
      {
        key: 'payerName',
        header: 'Payer',
        render: (payment) => (
          <Text size="sm" truncate maw={150}>
            {payment.payerName || '-'}
          </Text>
        ),
      },
      {
        key: 'paymentDesc',
        header: 'Method',
        width: 150,
        render: (payment) => (
          <Text size="sm">
            {payment.paymentDesc2 || payment.paymentDesc || '-'}
          </Text>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 120,
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
        key: 'actions',
        header: '',
        width: 50,
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
    ],
    [handleViewDocument, handleVoidClick]
  );

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconCash size={28} />
          <Title order={2}>Payments</Title>
          <Badge variant="light" color="gray" size="lg">{total}</Badge>
        </Group>
      </Group>

      {/* Filters */}
      <Paper withBorder p="md" radius="md">
        <Group gap="md">
          <TextInput
            placeholder="Search by document number, payer..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="All Types"
            value={documentType}
            onChange={setDocumentType}
            data={[
              { value: 'INVOICE', label: 'Invoice Payments' },
              { value: 'CREDIT', label: 'Credit Note Applications' },
              { value: 'BILL', label: 'Bill Payments' },
            ]}
            clearable
            w={200}
          />
        </Group>
      </Paper>

      {/* Payments Table */}
      <Paper withBorder radius="md" p="md">
        <DataTable
          columns={columns}
          data={payments}
          loading={isLoading}
          keyField="id"
          onRowClick={handleViewPayment}
          emptyMessage="No payments found"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          stickyActionsColumn={true}
        />
      </Paper>

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
                <Text size="sm" c="dimmed">Document</Text>
                <Text size="sm">{selectedPayment.documentNumber}</Text>
              </Group>
            </Stack>
          )}

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
    </Stack>
  );
}
