import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { useTabContext } from '../../contexts/TabContext';
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
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDotsVertical,
  IconArchive,
  IconFileInvoice,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { InvoiceLineItemsReadOnly } from '../../components/invoices';
import { PrintButton } from '../../components/common';

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
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [salespersonName, setSalespersonName] = useState<string | null>(null);

  const loadCreditNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE, { id: parseInt(id, 10) });
      if (result.success && result.data) {
        setCreditNote(result.data);

        const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_CREDIT_NOTE, {
          crNumber: result.data.crNumber,
        });
        if (itemsResult.success && itemsResult.data) {
          setLineItems(
            itemsResult.data.map((item: any, idx: number) => ({
              id: idx,
              sku: item.sku || '',
              description: item.description || '',
              quantity: parseFloat(item.quantity || '1'),
              unitPrice: item.unitPrice || '0',
              discount: item.discount || '0',
              isTaxable: item.isTaxable ?? false,
              amount: item.amount || '0',
            }))
          );
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
        const emp = res.data;
        const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.code;
        setSalespersonName(name);
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

  const handleViewInvoice = useCallback(async () => {
    if (!creditNote?.invNumber) return;
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, { invNumber: creditNote.invNumber });
      console.log('Invoice lookup result:', result);
      if (result.success && result.data) {
        openTab(`/invoices/${result.data.id}`);
      } else {
        notifications.show({ title: 'Invoice Not Found', message: `Invoice ${creditNote.invNumber} could not be found`, color: 'orange' });
      }
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to load invoice', color: 'red' });
    }
  }, [creditNote, openTab]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!creditNote) return null;

  const effectiveStatus = creditNote.isArchived ? 'archived' : creditNote.status;
  const balance = parseFloat(creditNote.total) - parseFloat(creditNote.totalUsed);

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
                  <Text size="sm" fw={600}>{formatCurrency(creditNote.total)}</Text>
                </Group>
                <Group gap={4}>
                  <Text size="sm" c="dimmed">Used:</Text>
                  <Text size="sm" fw={600} c="dimmed">{formatCurrency(creditNote.totalUsed)}</Text>
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
                {creditNote.invNumber && (
                  <Button size="xs" variant="light" leftSection={<IconFileInvoice size={14} />} onClick={handleViewInvoice}>
                    View Invoice
                  </Button>
                )}
                {!creditNote.isArchived && (
                  <Menu shadow="md" width={180}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" size="md">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={handleArchive}>
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
          {creditNote.clientName && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Client:</Text>
              <Text size="sm" fw={500}>{creditNote.clientName}</Text>
            </Group>
          )}
          {creditNote.invNumber && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Source Invoice:</Text>
              <Text
                size="sm"
                fw={500}
                c="blue"
                style={{ cursor: 'pointer' }}
                onClick={handleViewInvoice}
              >
                {creditNote.invNumber}
              </Text>
            </Group>
          )}
          {creditNote.reference && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Reference:</Text>
              <Text size="sm">{creditNote.reference}</Text>
            </Group>
          )}
          {salespersonName && (
            <Group gap={4}>
              <Text size="sm" c="dimmed">Salesperson:</Text>
              <Text
                size="sm"
                fw={500}
                c="violet"
                style={{ cursor: 'pointer' }}
                onClick={() => openTab(`/employees/${creditNote.salespersonId}`)}
              >
                {salespersonName}
              </Text>
            </Group>
          )}
        </Group>
      </Paper>

      {/* Line Items */}
      <InvoiceLineItemsReadOnly
        lineItems={lineItems}
        subTotal={creditNote.subTotal}
        tax={creditNote.tax}
        total={creditNote.total}
      />
    </Box>
  );
}
