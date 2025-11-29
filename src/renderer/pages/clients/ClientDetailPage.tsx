import { useParams, useNavigate } from 'react-router-dom';
import { Title, Tabs, Paper, Group, Button, LoadingOverlay, Text, ActionIcon, Tooltip, Modal, TextInput, Select, Stack, Pagination } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconEdit, IconUser, IconFileInvoice, IconCash, IconReceipt, IconSearch } from '@tabler/icons-react';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useClients, useInvoices, PaginatedResult } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import { ClientForm } from '../../components/forms/ClientForm';
import { DataTable, ColumnDef, RowClickOptions } from '../../components/common/DataTable/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { Client, Invoice } from '../../../main/database/schema';
import type { ClientFormData } from '../../utils/schemas';
import numeral from 'numeral';

const invoiceStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const INVOICE_PAGE_SIZE = 20;

// Simple cache for preloaded clients
const clientCache = new Map<number, Client>();

interface ClientDetailPageProps {
  id?: string;
}

export function ClientDetailPage({ id: propId }: ClientDetailPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const navigate = useNavigate();
  const { clients, getById, update } = useClients();
  const { fetchPaginated: fetchInvoicesPaginated } = useInvoices();
  const { activeTabId, updateTab, setTabTitle, findTabByPath, openTab } = useTabManager();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpened, setEditModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  // Invoice tab state
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('all');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [debouncedInvoiceSearch] = useDebouncedValue(invoiceSearch, 300);
  const [invoiceData, setInvoiceData] = useState<PaginatedResult<Invoice>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: INVOICE_PAGE_SIZE,
    totalPages: 0,
  });
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Use ref to avoid infinite loops with findTabByPath in useEffect
  const findTabByPathRef = useRef(findTabByPath);
  findTabByPathRef.current = findTabByPath;

  // Find current index and adjacent clients
  const { currentIndex, prevClient, nextClient } = useMemo(() => {
    if (!id || clients.length === 0) {
      return { currentIndex: -1, prevClient: null, nextClient: null };
    }
    const idx = clients.findIndex((c) => c.id === parseInt(id));
    return {
      currentIndex: idx,
      prevClient: idx > 0 ? clients[idx - 1] : null,
      nextClient: idx < clients.length - 1 ? clients[idx + 1] : null,
    };
  }, [id, clients]);

  // Navigate to a different client within the same tab
  const navigateToClient = useCallback((clientId: number, clientName: string) => {
    const newPath = `/clients/${clientId}`;
    if (activeTabId) {
      updateTab(activeTabId, newPath, clientName, clientId.toString());
    }
    // Reset loading state and load new client
    setLoading(true);
    setClient(null);
  }, [activeTabId, updateTab]);

  // Preload adjacent clients for faster navigation
  const preloadClient = useCallback(async (clientId: number) => {
    if (clientCache.has(clientId)) return;
    try {
      const data = await getById(clientId);
      if (data) {
        clientCache.set(clientId, data);
      }
    } catch {
      // Silently fail preloading
    }
  }, [getById]);

  useEffect(() => {
    const loadClient = async () => {
      if (!id) return;
      const clientId = parseInt(id);

      try {
        // Check cache first
        const cached = clientCache.get(clientId);
        if (cached) {
          setClient(cached);
          setLoading(false);
          // Update tab title with client name
          if (cached.name) {
            const currentPath = `/clients/${id}`;
            const tab = findTabByPathRef.current(currentPath);
            if (tab) {
              setTabTitle(tab.id, cached.name);
            }
          }
        } else {
          const data = await getById(clientId);
          setClient(data);
          // Cache the loaded client
          if (data) {
            clientCache.set(clientId, data);
          }
          // Update tab title with client name - find the tab for this specific client
          if (data?.name) {
            const currentPath = `/clients/${id}`;
            const tab = findTabByPathRef.current(currentPath);
            if (tab) {
              setTabTitle(tab.id, data.name);
            }
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load client:', error);
        setLoading(false);
      }
    };

    loadClient();
  }, [id, getById, setTabTitle]);

  // Preload adjacent clients after current client loads
  useEffect(() => {
    if (!client || loading) return;

    // Preload previous and next clients in background
    if (prevClient) {
      preloadClient(prevClient.id);
    }
    if (nextClient) {
      preloadClient(nextClient.id);
    }
  }, [client, loading, prevClient, nextClient, preloadClient]);

  // Reset invoice page when filters change
  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceStatus, debouncedInvoiceSearch]);

  // Fetch client invoices
  useEffect(() => {
    if (!client?.id) return;

    const loadInvoices = async () => {
      setInvoicesLoading(true);
      try {
        const result = await fetchInvoicesPaginated({
          page: invoicePage,
          pageSize: INVOICE_PAGE_SIZE,
          clientId: client.id,
          search: debouncedInvoiceSearch || undefined,
          status: invoiceStatus !== 'all' ? invoiceStatus : undefined,
        });
        setInvoiceData(result);
      } catch (error) {
        console.error('Failed to load invoices:', error);
      } finally {
        setInvoicesLoading(false);
      }
    };

    loadInvoices();
  }, [client?.id, invoicePage, invoiceStatus, debouncedInvoiceSearch, fetchInvoicesPaginated]);

  // Invoice table columns
  const invoiceColumns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        key: 'invoiceNumber',
        title: 'Invoice #',
        sortable: true,
        width: 120,
      },
      {
        key: 'createdAt',
        title: 'Date',
        sortable: true,
        render: (value) => (value ? new Date(value).toLocaleDateString() : 'N/A'),
      },
      {
        key: 'total',
        title: 'Total',
        sortable: true,
        render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
      },
      {
        key: 'amountPaid',
        title: 'Balance',
        sortable: true,
        render: (value, row) => {
          const total = parseFloat(row.total as string) || 0;
          const paid = parseFloat(value as string) || 0;
          return numeral(total - paid).format('$0,0.00');
        },
      },
      {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (value) => <StatusBadge status={value || 'DRAFT'} />,
      },
    ],
    []
  );

  // Handle invoice row click
  const handleInvoiceRowClick = useCallback(
    (invoice: Invoice, options?: RowClickOptions) => {
      openTab(
        {
          type: 'invoice-editor',
          path: `/invoices/${invoice.id}`,
          title: `Invoice ${invoice.invoiceNumber}`,
          entityId: invoice.id.toString(),
        },
        options?.newTab
      );
    },
    [openTab]
  );

  const handleSave = async (data: ClientFormData) => {
    if (!id) return;
    setSaving(true);
    try {
      // Convert numeric fields to strings for database compatibility
      const updateData = {
        ...data,
        creditLimit: String(data.creditLimit ?? 0),
        discountRate: String(data.discountRate ?? 0),
      };
      const updated = await update(parseInt(id), updateData);
      setClient(updated);
      // Update cache with new data
      if (updated) {
        clientCache.set(parseInt(id), updated);
      }
      // Update tab title if name changed - find the tab for this specific client
      if (updated?.name) {
        const currentPath = `/clients/${id}`;
        const tab = findTabByPathRef.current(currentPath);
        if (tab) {
          setTabTitle(tab.id, updated.name);
        }
      }
      setEditModalOpened(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!client) {
    return (
      <Paper p="xl">
        <Text>Client not found</Text>
        <Button onClick={() => navigate('/clients')} mt="md">
          Back to Clients
        </Button>
      </Paper>
    );
  }

  return (
    <div>
      <Group mb="md" justify="space-between">
        <Group>
          <Group gap={4}>
            <Tooltip label={prevClient ? `Previous: ${prevClient.name}` : 'No previous client'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                disabled={!prevClient}
                onClick={() => prevClient && navigateToClient(prevClient.id, prevClient.name)}
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={nextClient ? `Next: ${nextClient.name}` : 'No next client'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                disabled={!nextClient}
                onClick={() => nextClient && navigateToClient(nextClient.id, nextClient.name)}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Title order={2}>{client.name}</Title>
          {clients.length > 0 && currentIndex >= 0 && (
            <Text size="sm" c="dimmed">
              {currentIndex + 1} of {clients.length}
            </Text>
          )}
        </Group>
        <Button
          leftSection={<IconEdit size={16} />}
          variant="light"
          onClick={() => setEditModalOpened(true)}
        >
          Edit
        </Button>
      </Group>

      <Modal
        opened={editModalOpened}
        onClose={() => setEditModalOpened(false)}
        title="Edit Client"
        size="lg"
      >
        <ClientForm
          client={client}
          onSubmit={handleSave}
          onCancel={() => setEditModalOpened(false)}
          loading={saving}
        />
      </Modal>

      <Tabs defaultValue="info">
        <Tabs.List>
          <Tabs.Tab value="info" leftSection={<IconUser size={16} />}>
            Information
          </Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
            Invoices
          </Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
            Payments
          </Tabs.Tab>
          <Tabs.Tab value="credit" leftSection={<IconReceipt size={16} />}>
            Credit
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="info" pt="md">
          <Paper withBorder p="md">
            <Text fw={500} mb="xs">Contact Information</Text>
            <Text size="sm">Phone: {client.phone || 'N/A'}</Text>
            <Text size="sm">Email: {client.email || 'N/A'}</Text>
            <Text size="sm" mt="md" fw={500}>Address</Text>
            <Text size="sm">{client.address1 || 'N/A'}</Text>
            {client.address2 && <Text size="sm">{client.address2}</Text>}
            <Text size="sm" mt="md" fw={500}>Credit Details</Text>
            <Text size="sm">Credit Limit: { numeral(client.creditLimit ?? 0).format('$0,0.00')}</Text>
            <Text size="sm">Discount Rate: { numeral(parseFloat(client.discountRate || '0') / 100).format('0.0%')}</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="invoices" pt="md">
          <Stack gap="md">
            <Group>
              <TextInput
                placeholder="Search invoice #, reference..."
                leftSection={<IconSearch size={16} />}
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.currentTarget.value)}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <Select
                placeholder="Filter by status"
                data={invoiceStatusOptions}
                value={invoiceStatus}
                onChange={(value) => setInvoiceStatus(value || 'all')}
                w={160}
                clearable={false}
              />
              <Text size="sm" c="dimmed">
                {invoiceData.total} invoice{invoiceData.total !== 1 ? 's' : ''}
              </Text>
            </Group>

            <DataTable
              data={invoiceData.data}
              columns={invoiceColumns}
              loading={invoicesLoading}
              onRowClick={handleInvoiceRowClick}
              rowKey="id"
            />

            {invoiceData.totalPages > 1 && (
              <Group justify="center">
                <Pagination
                  total={invoiceData.totalPages}
                  value={invoicePage}
                  onChange={setInvoicePage}
                />
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Payment history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="credit" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Credit balance and history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
