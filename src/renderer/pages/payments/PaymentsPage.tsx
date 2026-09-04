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
import { IconSearch, IconCash, IconDotsVertical, IconX, IconFileInvoice, IconReceipt, IconFilterOff, IconRefresh } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';
import { useTabContext } from '../../contexts/TabContext';
import { DataTable, Column } from '../../components/common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../../components/common/DateRangeFilter';
import { CANONICAL_PAYMENT_METHOD_CODES } from '../../../shared/constants/payments';

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
  processedById: number | null;
  createdAt: string;
}

interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  active: boolean;
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
  const { openTab, replaceCurrentTab } = useTabContext();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<string | null>('INVOICE');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Void modal state
  const [voidModalOpen, { open: openVoidModal, close: closeVoidModal }] = useDisclosure(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const [startDate, endDate] = dateRange;
  const hasActiveFilters =
    search !== '' ||
    documentType !== null ||
    paymentMethod !== null ||
    startDate !== null ||
    endDate !== null;

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PAYMENTS_PAGINATED, {
        page,
        pageSize: 25,
        search: search || undefined,
        documentType: documentType || undefined,
        paymentMethod: paymentMethod || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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
  }, [page, search, documentType, paymentMethod, startDate, endDate]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Load active payment methods so we can resolve stored codes to display names
  useEffect(() => {
    window.electron
      .invoke(IpcChannel.GET_ACTIVE_PAYMENT_METHODS, {})
      .then((result) => {
        if (result.success && result.data) setPaymentMethods(result.data);
      })
      .catch((error) => console.error('Failed to load payment methods:', error));
  }, []);

  // The method code lives in paymentDesc on some code paths and paymentDesc2 on
  // others; notes live in paymentDesc unless that field held the method code.
  const methodNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    paymentMethods.forEach((pm) => map.set(pm.code, pm.name));
    return map;
  }, [paymentMethods]);

  const resolveMethod = useCallback((payment: Payment) => {
    const code = [payment.paymentDesc, payment.paymentDesc2].find(
      (v) => v && methodNameByCode.has(v)
    );
    return (code ? methodNameByCode.get(code) : payment.paymentDesc2 || payment.paymentDesc) || '-';
  }, [methodNameByCode]);

  const resolveNotes = useCallback((payment: Payment) =>
    payment.paymentDesc && !methodNameByCode.has(payment.paymentDesc) ? payment.paymentDesc : '',
    [methodNameByCode]
  );

  // Legacy method rows migrated from the old system share display names with the
  // canonical methods (under different codes), so deduplicate by name for the
  // filter. When a name collides, keep the canonical code as the value since
  // payment records are normalized to canonical codes.
  const methodFilterOptions = useMemo(() => {
    const byName = new Map<string, { value: string; label: string }>();
    for (const pm of paymentMethods) {
      const key = pm.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || CANONICAL_PAYMENT_METHOD_CODES.includes(pm.code)) {
        byName.set(key, { value: pm.code, label: pm.name });
      }
    }
    return Array.from(byName.values());
  }, [paymentMethods]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, documentType, paymentMethod, startDate, endDate]);

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
    replaceCurrentTab(`/payments/${payment.id}`);
  }, [replaceCurrentTab]);

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
          <Text size="sm" truncate maw={280}>
            {payment.payerName || '-'}
          </Text>
        ),
      },
      {
        key: 'paymentDesc',
        header: 'Method',
        width: 160,
        render: (payment) => (
          <Stack gap={0}>
            <Text size="sm">{resolveMethod(payment)}</Text>
            {payment.transactionReference && (
              <Text size="xs" c="dimmed" truncate maw={150}>
                Ref: {payment.transactionReference}
              </Text>
            )}
          </Stack>
        ),
      },
      {
        key: 'notes',
        header: 'Notes',
        render: (payment) => {
          const notes = resolveNotes(payment);
          return notes ? (
            <Text size="sm" c="dimmed" truncate maw={240}>
              {notes}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          );
        },
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
    [handleViewDocument, handleVoidClick, resolveMethod, resolveNotes]
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
        <Group gap="md" align="flex-end" wrap="wrap">
          <TextInput
            placeholder="Search by document number, payer..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
            miw={220}
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
          <Select
            placeholder="All Methods"
            value={paymentMethod}
            onChange={setPaymentMethod}
            data={methodFilterOptions}
            clearable
            searchable
            w={200}
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconFilterOff size={16} />}
              onClick={() => {
                setSearch('');
                setDocumentType(null);
                setPaymentMethod(null);
                setDateRange([null, null]);
              }}
            >
              Clear filters
            </Button>
          )}
          <ActionIcon variant="subtle" onClick={loadPayments} title="Refresh">
            <IconRefresh size={18} />
          </ActionIcon>
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
