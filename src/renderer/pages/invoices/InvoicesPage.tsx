import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Tabs,
  Badge,
  TextInput,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import {
  IconSearch,
  IconPlus,
  IconFileInvoice,
  IconClock,
  IconArchive,
  IconEye,
  IconEdit,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { PinVerificationModal } from '../../components/auth/PinVerificationModal';
import { SafeEmployee } from '../../contexts/AuthContext';
import { DataTable, Column } from '../../components/common/DataTable';

interface Invoice {
  id: number;
  invNumber: string;
  invDate: string;
  clientId: number | null;
  clientName: string | null;
  total: string;
  totalPaid: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
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
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
};

// Format currency
const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function InvoicesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('recent');
  const [draftInvoices, setDraftInvoices] = useState<Invoice[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [searchResults, setSearchResults] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingDrafts, setIsLoadingDrafts] = useState(true);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [accessModalOpen, { open: openAccessModal, close: closeAccessModal }] = useDisclosure(false);

  // Load draft invoices
  useEffect(() => {
    const loadDrafts = async () => {
      setIsLoadingDrafts(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_DRAFT_INVOICES, {});
        if (result.success && result.data) {
          setDraftInvoices(result.data);
        }
      } catch (error) {
        console.error('Failed to load drafts:', error);
      } finally {
        setIsLoadingDrafts(false);
      }
    };
    loadDrafts();
  }, []);

  // Load recent invoices
  useEffect(() => {
    const loadRecent = async () => {
      setIsLoadingRecent(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_RECENT_INVOICES, { limit: 20 });
        if (result.success && result.data) {
          setRecentInvoices(result.data);
        }
      } catch (error) {
        console.error('Failed to load recent:', error);
      } finally {
        setIsLoadingRecent(false);
      }
    };
    loadRecent();
  }, []);

  // Search invoices
  const searchInvoices = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_INVOICES, {
        query,
        limit: 50,
      });
      if (result.success && result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback(searchInvoices, 400);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.length >= 2) {
        setIsSearching(true);
        setActiveTab('all');
      }
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Handle salesperson verification for new invoice
  const handleNewInvoice = useCallback(() => {
    openAccessModal();
  }, [openAccessModal]);

  const handleAccessVerified = useCallback(
    (employee: SafeEmployee) => {
      closeAccessModal();
      // Navigate to invoice editor with salesperson info
      const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.code;
      navigate('/invoices/form', {
        state: {
          salespersonId: employee.id,
          salespersonName: employeeName,
        },
      });
    },
    [closeAccessModal, navigate]
  );

  // View invoice
  const handleViewInvoice = useCallback(
    (invoice: Invoice) => {
      navigate(`/invoices/${invoice.id}`);
    },
    [navigate]
  );

  // Edit draft invoice
  const handleEditDraft = useCallback(
    (id: number) => {
      navigate(`/invoices/form/${id}`);
    },
    [navigate]
  );

  // Base columns for all invoice tables
  const baseColumns: Column<Invoice>[] = useMemo(
    () => [
      {
        key: 'invNumber',
        header: 'Invoice #',
        width: 120,
        render: (invoice) => <Text fw={500}>{invoice.invNumber}</Text>,
      },
      {
        key: 'invDate',
        header: 'Date',
        width: 120,
        render: (invoice) => formatDate(invoice.invDate),
      },
      {
        key: 'clientName',
        header: 'Client',
        render: (invoice) => (
          <Text truncate maw={200}>
            {invoice.clientName || 'Walk-in Customer'}
          </Text>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        width: 100,
        render: (invoice) => <Text ta="right">{formatCurrency(invoice.total)}</Text>,
      },
      {
        key: 'totalPaid',
        header: 'Paid',
        width: 100,
        render: (invoice) => <Text ta="right">{formatCurrency(invoice.totalPaid)}</Text>,
      },
      {
        key: 'status',
        header: 'Status',
        width: 100,
        render: (invoice) => (
          <Badge color={statusColors[invoice.status] || 'gray'} variant="light">
            {statusLabels[invoice.status] || invoice.status}
          </Badge>
        ),
      },
    ],
    []
  );

  // Columns with actions for drafts (includes Edit button)
  const draftsColumns: Column<Invoice>[] = useMemo(
    () => [
      ...baseColumns,
      {
        key: 'actions',
        header: '',
        width: 80,
        render: (invoice) => (
          <Group gap="xs" justify="flex-end">
            <Tooltip label="View">
              <ActionIcon variant="subtle" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            {invoice.status === 'draft' && (
              <Tooltip label="Edit">
                <ActionIcon variant="subtle" color="blue" onClick={() => handleEditDraft(invoice.id)}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
    ],
    [baseColumns, navigate, handleEditDraft]
  );

  // Columns without edit for non-draft tables
  const viewOnlyColumns: Column<Invoice>[] = useMemo(
    () => [
      ...baseColumns,
      {
        key: 'actions',
        header: '',
        width: 50,
        render: (invoice) => (
          <Group gap="xs" justify="flex-end">
            <Tooltip label="View">
              <ActionIcon variant="subtle" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [baseColumns, navigate]
  );

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>Invoices</Title>
            <Text c="dimmed" size="sm">
              Manage and search invoices
            </Text>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={handleNewInvoice}>
            New Invoice
          </Button>
        </Group>

        {/* Search */}
        <TextInput
          placeholder="Search by invoice number, client name, or reference..."
          leftSection={isSearching ? <Loader size={14} /> : <IconSearch size={14} />}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          size="md"
        />

        {/* Tabs */}
        <Paper withBorder radius="md" p={0}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="recent" leftSection={<IconClock size={16} />}>
                Recent
              </Tabs.Tab>
              <Tabs.Tab value="all" leftSection={<IconArchive size={16} />}>
                All
                {searchQuery.length >= 2 && searchResults.length > 0 && (
                  <Badge ml="xs" size="sm" variant="light" color="blue">
                    {searchResults.length}
                  </Badge>
                )}
              </Tabs.Tab>
              <Tabs.Tab value="drafts" leftSection={<IconFileInvoice size={16} />}>
                Drafts
                {draftInvoices.length > 0 && (
                  <Badge ml="xs" size="sm" variant="light" color="gray">
                    {draftInvoices.length}
                  </Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

      {/* Recent Tab */}
            <Tabs.Panel value="recent" p="md">
              <DataTable
                columns={viewOnlyColumns}
                data={recentInvoices}
                loading={isLoadingRecent}
                keyField="id"
                onRowClick={handleViewInvoice}
                emptyMessage="No recent invoices"
                stickyActionsColumn
              />
            </Tabs.Panel>

            {/* All/Search Tab */}
            <Tabs.Panel value="all" p="md">
              {searchQuery.length < 2 ? (
                <Center py="xl">
                  <Stack align="center" gap="sm">
                    <IconSearch size={32} color="var(--mantine-color-dimmed)" />
                    <Text c="dimmed" size="sm" ta="center">
                      Enter at least 2 characters to search all invoices
                    </Text>
                  </Stack>
                </Center>
              ) : (
                <DataTable
                  columns={viewOnlyColumns}
                  data={searchResults}
                  loading={isSearching}
                  keyField="id"
                  onRowClick={handleViewInvoice}
                  emptyMessage={`No invoices found for "${searchQuery}"`}
                  stickyActionsColumn
                />
              )}
            </Tabs.Panel>

            {/* Drafts Tab */}
            <Tabs.Panel value="drafts" p="md">
              <DataTable
                columns={draftsColumns}
                data={draftInvoices}
                loading={isLoadingDrafts}
                keyField="id"
                onRowClick={handleViewInvoice}
                emptyMessage="No draft invoices"
                stickyActionsColumn
              />
            </Tabs.Panel>

      
          </Tabs>
        </Paper>
      </Stack>

      {/* Salesperson Access Modal */}
      <PinVerificationModal
        opened={accessModalOpen}
        onClose={closeAccessModal}
        onVerified={handleAccessVerified}
        title="Salesperson Verification"
        description="Enter your access code to create an invoice."
        requiredPermission="CREATE_INVOICE"
      />
    </>
  );
}
