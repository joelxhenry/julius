import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Badge,
  Loader,
  Center,
  Grid,
  ActionIcon,
  Menu,
  Divider,
  Alert,
  Card,
  Tabs,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconCash,
  IconFileText,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconArchive,
  IconAlertTriangle,
  IconCheck,
  IconPackage,
  IconReceipt,
  IconList,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { AdminOverrideModal, AdminOverrideResult, CreditIssue, RecordPaymentModal } from '../../components/invoices';
import { PaymentHistoryCard } from '../../components/payments';
import { DataTable, Column } from '../../components/common/DataTable';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  salespersonId: number | null;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  reference: string | null;
  subTotal: string;
  tax: string;
  total: string;
  totalPaid: string;
  status: string;
  isTaxable: boolean;
  pricing: string;
  creditTerms: string | null;
  isArchived: boolean;
  issuedAt: string | null;
  issuedById: number | null;
  adminOverrideById: number | null;
  adminOverrideNotes: string | null;
  adminOverrideAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LineItem {
  id: number;
  sku: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  amount: string;
  isTaxable: boolean;
}

interface CreditCheckResult {
  canCreateInvoice: boolean;
  requiresAdminOverride: boolean;
  reasons: CreditIssue[];
  creditLimit: number;
  currentBalance: number;
  overdueAmount: number;
  overdueInvoiceCount: number;
}

const statusColors: Record<string, string> = {
  draft: 'gray',
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  archived: 'Archived',
};

// Cache for adjacent invoices to improve navigation performance
interface InvoiceCache {
  invoice: Invoice;
  lineItems: LineItem[];
  adjacentIds: { previousId: number | null; nextId: number | null };
}

export function InvoiceDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });
  const [creditCheck, setCreditCheck] = useState<CreditCheckResult | null>(null);
  const [overrideModalOpen, { open: openOverrideModal, close: closeOverrideModal }] = useDisclosure(false);
  const [paymentModalOpen, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);

  // Cache for adjacent invoices
  const invoiceCacheRef = useRef<Map<number, InvoiceCache>>(new Map());

  // Update tab title when invoice loads (only when this tab is active)
  useEffect(() => {
    if (invoice && location.pathname === `/invoices/${id}`) {
      updateTabTitle(location.pathname, `Invoice ${invoice.invNumber}`);
    }
  }, [invoice, id, location.pathname, updateTabTitle]);

  // Helper function to load invoice data (used for both current and prefetching)
  const loadInvoiceData = useCallback(async (invoiceId: number): Promise<InvoiceCache | null> => {
    try {
      // Load invoice
      const invResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoiceId });
      if (!invResult.success || !invResult.data) {
        return null;
      }

      // Load line items
      const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_INVOICE, {
        invNumber: invResult.data.invNumber,
      });

      // Load adjacent invoices
      const adjResult = await window.electron.invoke(IpcChannel.GET_ADJACENT_INVOICES, { id: invoiceId });

      return {
        invoice: invResult.data,
        lineItems: itemsResult.success && itemsResult.data ? itemsResult.data : [],
        adjacentIds: adjResult.success && adjResult.data ? adjResult.data : { previousId: null, nextId: null },
      };
    } catch (error) {
      console.error('Failed to load invoice data:', error);
      return null;
    }
  }, []);

  // Prefetch adjacent invoices in background
  const prefetchAdjacentInvoices = useCallback(
    async (prevId: number | null, nextId: number | null) => {
      const cache = invoiceCacheRef.current;

      // Prefetch previous invoice if not cached
      if (prevId && !cache.has(prevId)) {
        loadInvoiceData(prevId).then((data) => {
          if (data) {
            cache.set(prevId, data);
          }
        });
      }

      // Prefetch next invoice if not cached
      if (nextId && !cache.has(nextId)) {
        loadInvoiceData(nextId).then((data) => {
          if (data) {
            cache.set(nextId, data);
          }
        });
      }
    },
    [loadInvoiceData]
  );

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) return;

      const invoiceId = parseInt(id, 10);
      const cache = invoiceCacheRef.current;

      // Check if we have this invoice cached
      const cachedData = cache.get(invoiceId);
      if (cachedData) {
        // Use cached data immediately
        setInvoice(cachedData.invoice);
        setLineItems(cachedData.lineItems);
        setAdjacentIds(cachedData.adjacentIds);
        setIsLoading(false);

        // Check credit if needed
        if (cachedData.invoice.clientId && ['draft', 'active', 'partially_paid'].includes(cachedData.invoice.status)) {
          const creditResult = await window.electron.invoke(IpcChannel.CHECK_CLIENT_CREDIT, {
            clientId: cachedData.invoice.clientId,
          });
          if (creditResult.success && creditResult.data) {
            setCreditCheck(creditResult.data);
          }
        } else {
          setCreditCheck(null);
        }

        // Prefetch adjacent invoices
        prefetchAdjacentInvoices(cachedData.adjacentIds.previousId, cachedData.adjacentIds.nextId);
        return;
      }

      setIsLoading(true);
      try {
        const data = await loadInvoiceData(invoiceId);

        if (data) {
          // Cache the loaded data
          cache.set(invoiceId, data);

          setInvoice(data.invoice);
          setLineItems(data.lineItems);
          setAdjacentIds(data.adjacentIds);

          // Prefetch adjacent invoices in background
          prefetchAdjacentInvoices(data.adjacentIds.previousId, data.adjacentIds.nextId);

          // Check credit if there's a client and invoice is not paid/archived
          if (data.invoice.clientId && ['draft', 'active', 'partially_paid'].includes(data.invoice.status)) {
            const creditResult = await window.electron.invoke(IpcChannel.CHECK_CLIENT_CREDIT, {
              clientId: data.invoice.clientId,
            });
            if (creditResult.success && creditResult.data) {
              setCreditCheck(creditResult.data);
            }
          } else {
            setCreditCheck(null);
          }
        } else {
          notifications.show({
            title: 'Error',
            message: 'Invoice not found',
            color: 'red',
          });
          navigate('/invoices');
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load invoice',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadInvoice();
  }, [id, navigate, loadInvoiceData, prefetchAdjacentInvoices]);

  // Format currency
  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || '0');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Navigate to previous/next invoice (same tab)
  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        // Use replaceCurrentTab to stay in the same tab
        replaceCurrentTab(`/invoices/${targetId}`);
      }
    },
    [replaceCurrentTab]
  );

  // Issue invoice (draft -> active)
  const handleIssueInvoice = useCallback(async () => {
    if (!invoice) return;

    // Check credit first
    if (creditCheck?.requiresAdminOverride) {
      openOverrideModal();
      return;
    }

    try {
      // TODO: Get current salesperson ID from context/session
      const result = await window.electron.invoke(IpcChannel.ISSUE_INVOICE, {
        invoiceId: invoice.id,
        issuedById: invoice.salespersonId || 1, // Fallback to 1 for now
      });

      if (result.success) {
        notifications.show({
          title: 'Invoice Issued',
          message: `Invoice ${invoice.invNumber} has been issued`,
          color: 'green',
        });
        // Reload the invoice
        const updatedResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
        if (updatedResult.success && updatedResult.data) {
          setInvoice(updatedResult.data);
        }
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to issue invoice',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to issue invoice',
        color: 'red',
      });
    }
  }, [invoice, creditCheck, openOverrideModal]);

  // Handle admin override approval
  const handleOverrideApproved = useCallback(
    async (result: AdminOverrideResult) => {
      if (!invoice) return;

      try {
        const issueResult = await window.electron.invoke(IpcChannel.ISSUE_INVOICE, {
          invoiceId: invoice.id,
          issuedById: invoice.salespersonId || 1,
          adminOverrideById: result.adminId,
          adminOverrideNotes: result.notes,
        });

        if (issueResult.success) {
          notifications.show({
            title: 'Invoice Issued',
            message: `Invoice ${invoice.invNumber} has been issued with admin override`,
            color: 'green',
          });
          // Reload the invoice
          const updatedResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
          if (updatedResult.success && updatedResult.data) {
            setInvoice(updatedResult.data);
          }
        } else {
          notifications.show({
            title: 'Error',
            message: issueResult.error || 'Failed to issue invoice',
            color: 'red',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to issue invoice',
          color: 'red',
        });
      }
    },
    [invoice]
  );

  // Archive invoice
  const handleArchive = useCallback(async () => {
    if (!invoice) return;

    try {
      const result = await window.electron.invoke(IpcChannel.ARCHIVE_INVOICE, { id: invoice.id });
      if (result.success) {
        notifications.show({
          title: 'Invoice Archived',
          message: `Invoice ${invoice.invNumber} has been archived`,
          color: 'green',
        });
        navigate('/invoices');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to archive invoice',
        color: 'red',
      });
    }
  }, [invoice, navigate]);

  // Open payment modal
  const handleRecordPayment = useCallback(() => {
    openPaymentModal();
  }, [openPaymentModal]);

  // Handle payment recorded - refresh invoice data
  const handlePaymentRecorded = useCallback(async () => {
    if (!invoice) return;

    // Reload invoice to get updated totalPaid and status
    const updatedResult = await window.electron.invoke(IpcChannel.GET_INVOICE, { id: invoice.id });
    if (updatedResult.success && updatedResult.data) {
      setInvoice(updatedResult.data);
      // Also update the cache
      const cache = invoiceCacheRef.current;
      const cached = cache.get(invoice.id);
      if (cached) {
        cache.set(invoice.id, { ...cached, invoice: updatedResult.data });
      }
    }
  }, [invoice]);

  // Navigate to create credit note
  const handleCreateCreditNote = useCallback(() => {
    if (invoice) {
      navigate(`/credit-notes/new?invoiceId=${invoice.id}`);
    }
  }, [invoice, navigate]);

  // Navigate to client
  const handleViewClient = useCallback(() => {
    if (invoice?.clientId) {
      navigate(`/clients/${invoice.clientId}`);
    }
  }, [invoice, navigate]);

  // View inventory item (removed navigation to prevent leaving invoice page)
  // Users can use spotlight search (Cmd/Ctrl+K) to quickly find inventory items if needed

  // Line items table columns
  const lineItemColumns: Column<LineItem>[] = useMemo(
    () => [
      {
        key: 'sku',
        header: 'SKU',
        width: 150,
        render: (item) => (
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {item.sku}
            </Text>
            <IconPackage size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
          </Group>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (item) => (
          <Text size="sm" truncate maw={250}>
            {item.description || '-'}
          </Text>
        ),
      },
      {
        key: 'quantity',
        header: 'Qty',
        width: 80,
        render: (item) => <Text ta="center">{item.quantity}</Text>,
      },
      {
        key: 'unitPrice',
        header: 'Unit Price',
        width: 120,
        render: (item) => <Text ta="right">{formatCurrency(item.unitPrice)}</Text>,
      },
      {
        key: 'discount',
        header: 'Discount',
        width: 120,
        render: (item) =>
          parseFloat(item.discount) > 0 ? (
            <Stack gap={0} align="flex-end">
              <Text size="sm" c="red">
                -{formatCurrency((parseFloat(item.unitPrice) * item.quantity * parseFloat(item.discount) / 100).toFixed(2))}
              </Text>
              <Text size="xs" c="dimmed">
                ({item.discount}%)
              </Text>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="right">
              -
            </Text>
          ),
      },
      {
        key: 'amount',
        header: 'Amount',
        width: 120,
        render: (item) => <Text ta="right" fw={500}>{formatCurrency(item.amount)}</Text>,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!invoice) {
    return null;
  }

  const balance = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Stack gap={4}>
              <Group gap="sm">
                <Title order={2}>Invoice {invoice.invNumber}</Title>
                <Badge color={statusColors[invoice.status]} variant="light" size="lg">
                  {statusLabels[invoice.status]}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Created {formatDate(invoice.createdAt)}
                {invoice.issuedAt && ` • Issued ${formatDate(invoice.issuedAt)}`}
              </Text>
            </Stack>
          </Group>

          <Group gap="sm">
            {/* Navigation */}
            <Group gap={4}>
              <ActionIcon
                variant="subtle"
                disabled={!adjacentIds.previousId}
                onClick={() => handleNavigateAdjacent(adjacentIds.previousId)}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                disabled={!adjacentIds.nextId}
                onClick={() => handleNavigateAdjacent(adjacentIds.nextId)}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>

            {/* Quick Actions */}
            {invoice.status === 'draft' && (
              <Button leftSection={<IconCheck size={16} />} color="green" onClick={handleIssueInvoice}>
                Issue Invoice
              </Button>
            )}
            {invoice.status === 'draft' && (
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
              >
                Edit
              </Button>
            )}
            {['active', 'partially_paid'].includes(invoice.status) && (
              <Button leftSection={<IconCash size={16} />} onClick={handleRecordPayment}>
                Record Payment
              </Button>
            )}

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {['active', 'partially_paid', 'paid'].includes(invoice.status) && (
                  <Menu.Item leftSection={<IconFileText size={16} />} onClick={handleCreateCreditNote}>
                    Create Credit Note
                  </Menu.Item>
                )}
                {invoice.clientId && (
                  <Menu.Item leftSection={<IconUser size={16} />} onClick={handleViewClient}>
                    View Client
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={handleArchive}>
                  Archive Invoice
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Credit Warning */}
        {creditCheck?.requiresAdminOverride && invoice.status === 'draft' && (
          <Alert icon={<IconAlertTriangle size={16} />} color="orange" title="Credit Issues Detected">
            {creditCheck.reasons.map((reason, idx) => (
              <Text key={idx} size="sm">
                {reason.message}
              </Text>
            ))}
          </Alert>
        )}

        {/* Admin Override Info */}
        {invoice.adminOverrideById && (
          <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" title="Admin Override Applied">
            <Text size="sm">
              This invoice was issued with an admin override.
              {invoice.adminOverrideNotes && ` Notes: ${invoice.adminOverrideNotes}`}
            </Text>
          </Alert>
        )}

        <Grid>
          {/* Invoice Details */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Invoice Details</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Invoice Number
                    </Text>
                    <Text fw={500}>{invoice.invNumber}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Invoice Date
                    </Text>
                    <Text fw={500}>{formatDate(invoice.invDate)}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Reference
                    </Text>
                    <Text fw={500}>{invoice.reference || '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Credit Terms
                    </Text>
                    <Text fw={500}>{invoice.creditTerms || '-'}</Text>
                  </Grid.Col>
                </Grid>

                <Divider />

                <Text fw={600}>Client Information</Text>
                <Grid>
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">
                      Client Name
                    </Text>
                    <Group gap="xs">
                      <Text fw={500}>{invoice.clientName || 'Walk-in Customer'}</Text>
                      {invoice.clientId && (
                        <ActionIcon variant="subtle" size="sm" onClick={handleViewClient}>
                          <IconUser size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Grid.Col>
                  {(invoice.clientAddress1 || invoice.clientAddress2) && (
                    <Grid.Col span={12}>
                      <Text size="sm" c="dimmed">
                        Address
                      </Text>
                      <Text fw={500}>
                        {[invoice.clientAddress1, invoice.clientAddress2].filter(Boolean).join(', ')}
                      </Text>
                    </Grid.Col>
                  )}
                  {invoice.clientPhone && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">
                        Phone
                      </Text>
                      <Text fw={500}>{invoice.clientPhone}</Text>
                    </Grid.Col>
                  )}
                </Grid>
              </Stack>
            </Paper>

            {/* Tabs for Line Items and Payments */}
            <Paper withBorder radius="md" mt="md">
              <Tabs defaultValue="items">
                <Tabs.List>
                  <Tabs.Tab value="items" leftSection={<IconList size={14} />}>
                    Line Items ({lineItems.length})
                  </Tabs.Tab>
                  {invoice.status !== 'draft' && (
                    <Tabs.Tab value="payments" leftSection={<IconCash size={14} />}>
                      Payments
                    </Tabs.Tab>
                  )}
                </Tabs.List>

                <Tabs.Panel value="items" p="md">
                  <DataTable
                    columns={lineItemColumns}
                    data={lineItems}
                    keyField="id"
                    emptyMessage="No line items found"
                    minWidth={700}
                  />
                </Tabs.Panel>

                {invoice.status !== 'draft' && (
                  <Tabs.Panel value="payments" p="md">
                    <PaymentHistoryCard
                      key={invoice.totalPaid}
                      invoiceNumber={invoice.invNumber}
                      invoiceTotal={parseFloat(invoice.total)}
                      totalPaid={parseFloat(invoice.totalPaid)}
                      onPaymentVoided={handlePaymentRecorded}
                    />
                  </Tabs.Panel>
                )}
              </Tabs>
            </Paper>
          </Grid.Col>

          {/* Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Summary</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Subtotal
                    </Text>
                    <Text size="sm">{formatCurrency(invoice.subTotal)}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Tax
                    </Text>
                    <Text size="sm">{formatCurrency(invoice.tax)}</Text>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text fw={600}>Total</Text>
                    <Text fw={600} size="lg">
                      {formatCurrency(invoice.total)}
                    </Text>
                  </Group>
                  <Divider />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Paid
                    </Text>
                    <Text size="sm" c="green">
                      {formatCurrency(invoice.totalPaid)}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text fw={500}>Balance Due</Text>
                    <Text fw={500} c={balance > 0 ? 'red' : 'green'}>
                      {formatCurrency(balance.toFixed(2))}
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>

            {/* Quick Actions Card */}
            <Card withBorder p="md" radius="md" mt="md">
              <Stack gap="sm">
                <Text fw={600}>Quick Actions</Text>
                {invoice.status === 'draft' && (
                  <Button fullWidth variant="light" color="green" leftSection={<IconCheck size={16} />} onClick={handleIssueInvoice}>
                    Issue Invoice
                  </Button>
                )}
                {['active', 'partially_paid'].includes(invoice.status) && (
                  <Button fullWidth variant="light" leftSection={<IconCash size={16} />} onClick={handleRecordPayment}>
                    Record Payment
                  </Button>
                )}
                {invoice.clientId && (
                  <Button fullWidth variant="subtle" leftSection={<IconUser size={16} />} onClick={handleViewClient}>
                    View Client
                  </Button>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Admin Override Modal */}
      {creditCheck && (
        <AdminOverrideModal
          opened={overrideModalOpen}
          onClose={closeOverrideModal}
          onApproved={handleOverrideApproved}
          clientName={invoice.clientName || 'Unknown Client'}
          creditIssues={creditCheck.reasons}
        />
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        opened={paymentModalOpen}
        onClose={closePaymentModal}
        onPaymentRecorded={handlePaymentRecorded}
        invoice={invoice}
      />
    </>
  );
}
