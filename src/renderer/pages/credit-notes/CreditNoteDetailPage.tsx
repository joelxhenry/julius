import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { useTabContext } from '../../contexts/TabContext';
import { usePermissions, RestrictedLink } from '../../permissions';
import { employeeDisplayName } from '../../utils/employeeName';
import {
  Box,
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  Button,
  Menu,
  Loader,
  Center,
  Stack,
  ThemeIcon,
  SimpleGrid,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDotsVertical,
  IconArchive,
  IconFileInvoice,
  IconUser,
  IconReceipt,
  IconChevronRight,
  IconCash,
  IconRefresh,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { PrintButton, DataTable, Column } from '../../components/common';
import { CreditNoteRefundModal } from '../../components/invoices';

interface CreditNote {
  id: number;
  crNumber: string;
  invNumber: string | null;
  crDate: string;
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
  totalUsed: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
}

interface UsagePayment {
  id: number;
  invoiceNumber: string | null;
  paymentDate: string | null;
  paymentDesc: string | null;
  paymentDesc2: string | null;
  transactionReference: string | null;
  amount: string;
  createdAt: string;
}

interface SourceInvoice {
  id: number;
  invNumber: string;
  invDate: string;
  total: string;
  totalPaid: string;
  status: string;
}

interface ClientInfo {
  id: number;
  clientName: string;
  contact: string | null;
  phone: string | null;
  address1: string | null;
  address2: string | null;
}

const statusColors: Record<string, string> = {
  A: 'green',
  U: 'gray',
  archived: 'gray',
};

const statusLabels: Record<string, string> = {
  A: 'Active',
  U: 'Used',
  archived: 'Archived',
};

const invoiceStatusColors: Record<string, string> = {
  active: 'blue',
  partially_paid: 'orange',
  paid: 'green',
  archived: 'gray',
  cancelled: 'red',
};

const formatCurrency = (value: string | number | null) => {
  const num = typeof value === 'number' ? value : parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function CreditNoteDetailPage() {
  const { id } = useTabParams<{ id: string }>();
  const location = useLocation();
  const { updateTabTitle, replaceCurrentTab, openTab } = useTabContext();
  const { runWithPermission } = usePermissions();
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [usage, setUsage] = useState<UsagePayment[]>([]);
  const [sourceInvoice, setSourceInvoice] = useState<SourceInvoice | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [salespersonName, setSalespersonName] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const loadCreditNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE, { id: parseInt(id, 10) });
      if (result.success && result.data) {
        const cn: CreditNote = result.data;
        setCreditNote(cn);

        // How the credit note funds were used: each application is a CREDIT payment
        // against an invoice; negative amounts are void reversals that restore balance.
        const usageResult = await window.electron.invoke(IpcChannel.GET_PAYMENTS_BY_CREDIT_NOTE, {
          creditNoteNumber: cn.crNumber,
        });
        setUsage(usageResult.success && usageResult.data ? usageResult.data : []);

        // Source invoice attached to the credit note
        if (cn.invNumber) {
          const invResult = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, { invNumber: cn.invNumber });
          setSourceInvoice(invResult.success && invResult.data ? invResult.data : null);
        } else {
          setSourceInvoice(null);
        }

        // Client attached to the credit note
        if (cn.clientId) {
          const clientResult = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: cn.clientId });
          setClient(clientResult.success && clientResult.data ? clientResult.data : null);
        } else {
          setClient(null);
        }
      } else {
        notifications.show({ title: 'Error', message: 'Credit note not found', color: 'red' });
        replaceCurrentTab('/credit-notes');
      }
    } catch (error) {
      notifications.show({ title: 'Error', message: 'Failed to load credit note', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [id, replaceCurrentTab]);

  useEffect(() => {
    loadCreditNote();
  }, [loadCreditNote]);

  useEffect(() => {
    if (!creditNote?.salespersonId) { setSalespersonName(null); return; }
    window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id: creditNote.salespersonId }).then((res) => {
      if (res.success && res.data) {
        setSalespersonName(employeeDisplayName(res.data));
      }
    });
  }, [creditNote?.salespersonId]);

  useEffect(() => {
    if (creditNote && location.pathname === `/credit-notes/${id}`) {
      updateTabTitle(location.pathname, `Credit Note ${creditNote.crNumber}`);
    }
  }, [creditNote, id, location.pathname, updateTabTitle]);

  const handleArchive = useCallback(async () => {
    if (!creditNote) return;
    try {
      const result = await window.electron.invoke(IpcChannel.ARCHIVE_CREDIT_NOTE, { id: creditNote.id });
      if (result.success) {
        notifications.show({ title: 'Archived', message: `Credit note ${creditNote.crNumber} has been archived`, color: 'green' });
        loadCreditNote();
      } else {
        notifications.show({ title: 'Error', message: result.error || 'Failed to archive', color: 'red' });
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to archive credit note', color: 'red' });
    }
  }, [creditNote, loadCreditNote]);

  // Archiving requires ARCHIVE_CREDIT_NOTE; otherwise elevate via another user (recorded).
  const requestArchive = useCallback(() => {
    if (!creditNote) return;
    runWithPermission(
      { permissionCode: 'ARCHIVE_CREDIT_NOTE', actionLabel: `Archive credit note ${creditNote.crNumber}`, context: { entity: 'credit_note', id: creditNote.id } },
      handleArchive
    );
  }, [creditNote, runWithPermission, handleArchive]);

  // Cashing out / refunding a credit note requires REFUND_CREDIT_NOTE; otherwise
  // elevate via another user (recorded), same pattern as archiving.
  const requestRefund = useCallback(() => {
    if (!creditNote) return;
    runWithPermission(
      { permissionCode: 'REFUND_CREDIT_NOTE', actionLabel: `Cash out / refund credit note ${creditNote.crNumber}`, context: { entity: 'credit_note', id: creditNote.id } },
      () => setRefundModalOpen(true)
    );
  }, [creditNote, runWithPermission]);

  const handleViewInvoice = useCallback(() => {
    if (sourceInvoice) {
      openTab(`/invoices/${sourceInvoice.id}`);
    } else if (creditNote?.invNumber) {
      notifications.show({ title: 'Invoice Not Found', message: `Invoice ${creditNote.invNumber} could not be found`, color: 'orange' });
    }
  }, [sourceInvoice, creditNote, openTab]);

  // Open the invoice a usage entry was applied to (looked up by number → id).
  const openInvoiceByNumber = useCallback(async (invNumber: string | null) => {
    if (!invNumber) return;
    const res = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, { invNumber });
    if (res.success && res.data) {
      openTab(`/invoices/${res.data.id}`);
    } else {
      notifications.show({ title: 'Invoice Not Found', message: `Invoice ${invNumber} could not be found`, color: 'orange' });
    }
  }, [openTab]);

  // Match each positive application to a void reversal so we can strike it through.
  const voidedIds = useMemo(() => {
    const voided = new Set<number>();
    const reversals = usage.filter((p) => parseFloat(p.amount) < 0 && p.paymentDesc?.includes('VOID'));
    if (reversals.length === 0) return voided;
    usage.forEach((p) => {
      if (parseFloat(p.amount) > 0 && !p.paymentDesc?.includes('VOID')) {
        if (reversals.some((v) => Math.abs(parseFloat(v.amount)) === parseFloat(p.amount))) {
          voided.add(p.id);
        }
      }
    });
    return voided;
  }, [usage]);

  const usageColumns: Column<UsagePayment>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date',
      width: 120,
      render: (row) => <Text size="sm">{formatDate(row.paymentDate || row.createdAt)}</Text>,
    },
    {
      key: 'appliedTo',
      header: 'Applied To',
      render: (row) => {
        if (!row.invoiceNumber) return <Text size="sm" c="dimmed">-</Text>;
        return (
          <RestrictedLink
            permission="VIEW_INVOICES"
            color="blue"
            fw={500}
            onClick={() => openInvoiceByNumber(row.invoiceNumber)}
          >
            {row.invoiceNumber}
          </RestrictedLink>
        );
      },
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => {
        const isVoidEntry = parseFloat(row.amount) < 0 || row.paymentDesc?.includes('VOID');
        return (
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c={isVoidEntry ? 'red' : undefined}>
              {row.paymentDesc || row.paymentDesc2 || (isVoidEntry ? 'Reversal' : 'Applied to invoice')}
            </Text>
            {voidedIds.has(row.id) && <Badge size="xs" color="red" variant="outline">Voided</Badge>}
          </Group>
        );
      },
    },
    {
      key: 'reference',
      header: 'Reference',
      width: 140,
      render: (row) => <Text size="sm" c="dimmed" truncate maw={140}>{row.transactionReference || '-'}</Text>,
    },
    {
      key: 'amount',
      header: 'Amount',
      width: 130,
      render: (row) => {
        const amount = parseFloat(row.amount);
        const isVoidEntry = amount < 0 || row.paymentDesc?.includes('VOID');
        const isVoided = voidedIds.has(row.id);
        return (
          <Text
            size="sm"
            fw={600}
            ta="right"
            c={isVoidEntry ? 'red' : isVoided ? 'dimmed' : 'teal'}
            td={isVoided ? 'line-through' : undefined}
          >
            {isVoidEntry ? '+' : '-'}{formatCurrency(Math.abs(amount))}
          </Text>
        );
      },
    },
  ], [voidedIds, openInvoiceByNumber]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!creditNote) return null;

  const total = parseFloat(creditNote.total);
  const totalUsed = parseFloat(creditNote.totalUsed);
  const balance = total - totalUsed;
  // Derive status from the remaining balance so fully-used notes always read as
  // "Used", even if the stored status is stale.
  const effectiveStatus = creditNote.isArchived ? 'archived' : balance > 0 ? 'A' : 'U';

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', gap: 8 }}>
      {/* Header with Back Button */}
      <Group gap="sm" align="center" wrap="nowrap">
        <ActionIcon
          variant="subtle"
          size="lg"
          onClick={() => replaceCurrentTab('/credit-notes')}
          title="Back to Credit Notes"
        >
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Box style={{ flex: 1 }}>
          <Paper withBorder p="xs" radius="md" style={{ height: 50 }}>
            <Group justify="space-between" wrap="nowrap" h="100%">
              {/* Left: CR Number and Status */}
              <Group gap="sm" wrap="nowrap">
                <Text fw={600} size="lg">
                  Credit Note {creditNote.crNumber}
                </Text>
                <Badge color={statusColors[effectiveStatus] || 'gray'} variant="light" size="sm">
                  {statusLabels[effectiveStatus] || effectiveStatus}
                </Badge>
              </Group>

              {/* Center: Totals */}
              <Group gap="lg" wrap="nowrap">
                <Group gap={4}>
                  <Text size="sm" c="dimmed">Total:</Text>
                  <Text size="sm" fw={600}>{formatCurrency(total)}</Text>
                </Group>
                <Group gap={4}>
                  <Text size="sm" c="dimmed">Used:</Text>
                  <Text size="sm" fw={600} c="dimmed">{formatCurrency(totalUsed)}</Text>
                </Group>
                <Group gap={4}>
                  <Text size="sm" c="dimmed">Remaining:</Text>
                  <Text size="sm" fw={700} c={balance > 0 ? 'green' : 'dimmed'}>
                    {formatCurrency(balance)}
                  </Text>
                </Group>
              </Group>

              {/* Right: Actions */}
              <Group gap="sm" wrap="nowrap">
                <ActionIcon variant="subtle" size="md" onClick={loadCreditNote} title="Refresh">
                  <IconRefresh size={18} />
                </ActionIcon>
                {creditNote.invNumber && (
                  <Button size="xs" variant="light" leftSection={<IconFileInvoice size={14} />} onClick={handleViewInvoice}>
                    View Invoice
                  </Button>
                )}
                {!creditNote.isArchived && balance > 0.001 && (
                  <Button size="xs" variant="light" color="teal" leftSection={<IconCash size={14} />} onClick={requestRefund}>
                    Cash Out / Refund
                  </Button>
                )}
                {!creditNote.isArchived && (
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="md">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={requestArchive}>
                        Archive Credit Note
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Group>
          </Paper>
        </Box>
        <PrintButton documentType="credit_note" documentId={creditNote.id} />
      </Group>

      {/* Info Bar */}
      <Paper withBorder p="sm" radius="md">
        <Group gap="xl" wrap="wrap">
          <Group gap={4}>
            <Text size="sm" c="dimmed">Date:</Text>
            <Text size="sm" fw={500}>{formatDate(creditNote.crDate)}</Text>
          </Group>
          {creditNote.reference && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Reference:</Text>
              <Text size="sm">{creditNote.reference}</Text>
            </Group>
          )}
          {salespersonName && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Salesperson:</Text>
              <RestrictedLink
                permission="VIEW_EMPLOYEES"
                color="violet"
                fw={500}
                onClick={() => openTab(`/employees/${creditNote.salespersonId}`)}
              >
                {salespersonName}
              </RestrictedLink>
            </Group>
          )}
        </Group>
      </Paper>

      {/* Attached Invoice & Client cards */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
        {/* Source Invoice */}
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs" mb={sourceInvoice || creditNote.invNumber ? 'xs' : 0}>
            <ThemeIcon variant="light" color="blue" size="sm">
              <IconFileInvoice size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Attached Invoice</Text>
          </Group>
          {sourceInvoice ? (
            <UnstyledButton
              onClick={handleViewInvoice}
              style={{ width: '100%', borderRadius: 'var(--mantine-radius-sm)' }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Box>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} c="blue">{sourceInvoice.invNumber}</Text>
                    <Badge size="xs" variant="light" color={invoiceStatusColors[sourceInvoice.status] || 'gray'}>
                      {sourceInvoice.status.replace('_', ' ')}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{formatDate(sourceInvoice.invDate)}</Text>
                </Box>
                <Group gap="xs" wrap="nowrap">
                  <Box ta="right">
                    <Text size="xs" c="dimmed">Total</Text>
                    <Text size="sm" fw={600}>{formatCurrency(sourceInvoice.total)}</Text>
                  </Box>
                  <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
                </Group>
              </Group>
            </UnstyledButton>
          ) : creditNote.invNumber ? (
            <Text size="sm">{creditNote.invNumber} <Text span size="xs" c="dimmed">(not found)</Text></Text>
          ) : (
            <Text size="sm" c="dimmed">No invoice attached</Text>
          )}
        </Paper>

        {/* Client */}
        <Paper withBorder p="sm" radius="md">
          <Group gap="xs" mb={client || creditNote.clientName ? 'xs' : 0}>
            <ThemeIcon variant="light" color="violet" size="sm">
              <IconUser size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Client</Text>
          </Group>
          {client ? (
            <UnstyledButton
              onClick={() => openTab(`/clients/${client.id}`)}
              style={{ width: '100%', borderRadius: 'var(--mantine-radius-sm)' }}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Box>
                  <Text size="sm" fw={600} c="violet">{client.clientName}</Text>
                  {client.phone && <Text size="xs" c="dimmed">{client.phone}</Text>}
                  {client.address1 && <Text size="xs" c="dimmed">{[client.address1, client.address2].filter(Boolean).join(', ')}</Text>}
                </Box>
                <IconChevronRight size={16} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
              </Group>
            </UnstyledButton>
          ) : creditNote.clientName ? (
            <Text size="sm">{creditNote.clientName}</Text>
          ) : (
            <Text size="sm" c="dimmed">Walk-in / no client</Text>
          )}
        </Paper>
      </SimpleGrid>

      {/* Activity: how the credit note funds were used */}
      <Paper withBorder radius="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Group justify="space-between" p="sm" pb="xs">
          <Group gap="xs">
            <ThemeIcon variant="light" color="teal" size="sm">
              <IconReceipt size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">Usage Activity</Text>
          </Group>
          <Text size="xs" c="dimmed">How the credit note funds have been applied</Text>
        </Group>

        <Box style={{ flex: 1, overflow: 'auto' }} px="sm">
          {usage.length === 0 ? (
            <Stack align="center" py="xl" gap="xs">
              <ThemeIcon variant="light" color="gray" size="lg" radius="xl">
                <IconReceipt size={18} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">This credit note has not been applied to any invoices yet.</Text>
            </Stack>
          ) : (
            <DataTable
              columns={usageColumns}
              data={usage}
              keyField="id"
              minWidth={600}
              verticalSpacing="xs"
              onRowClick={(row) => openInvoiceByNumber(row.invoiceNumber)}
            />
          )}
        </Box>

        {/* Summary footer */}
        <Group justify="flex-end" gap="xl" p="sm" pr={92} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Group gap={6}>
            <Text size="sm" c="dimmed">Issued:</Text>
            <Text size="sm" fw={600}>{formatCurrency(total)}</Text>
          </Group>
          <Group gap={6}>
            <Text size="sm" c="dimmed">Used:</Text>
            <Text size="sm" fw={600} c="teal">{formatCurrency(totalUsed)}</Text>
          </Group>
          <Group gap={6}>
            <Text size="sm" c="dimmed">Remaining:</Text>
            <Text size="sm" fw={700} c={balance > 0 ? 'green' : 'dimmed'}>{formatCurrency(balance)}</Text>
          </Group>
        </Group>
      </Paper>

      <CreditNoteRefundModal
        opened={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onRefunded={loadCreditNote}
        creditNote={creditNote}
      />
    </Box>
  );
}
