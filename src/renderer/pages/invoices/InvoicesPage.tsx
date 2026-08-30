import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
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
  SegmentedControl,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import {
  IconSearch,
  IconPlus,
  IconClock,
  IconArchive,
  IconEye,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { PinVerificationModal } from '../../components/auth/PinVerificationModal';
import { SafeEmployee } from '../../contexts/AuthContext';
import { employeeDisplayName } from '../../utils/employeeName';
import { DataTable, Column, SortDirection } from '../../components/common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../../components/common/DateRangeFilter';

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
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
  cancelled: 'red',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  partially_paid: 'Partial',
  paid: 'Paid',
  archived: 'Archived',
  cancelled: 'Cancelled',
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
  const { replaceCurrentTab } = useTabContext();
  const [activeTab, setActiveTab] = useState<string | null>('recent');
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [searchResults, setSearchResults] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [accessModalOpen, { open: openAccessModal, close: closeAccessModal }] = useDisclosure(false);
  const [sortField, setSortField] = useState<string>('invDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const [startDate, endDate] = dateRange;

  // Handle sort change
  const handleSort = useCallback((field: string, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Filter invoices by status
  const filteredRecent = useMemo(() => {
    if (statusFilter === 'all') return recentInvoices;
    return recentInvoices.filter((inv) => inv.status === statusFilter);
  }, [recentInvoices, statusFilter]);

  const filteredSearch = useMemo(() => {
    if (statusFilter === 'all') return searchResults;
    return searchResults.filter((inv) => inv.status === statusFilter);
  }, [searchResults, statusFilter]);

  // Load recent invoices
  useEffect(() => {
    const loadRecent = async () => {
      setIsLoadingRecent(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_RECENT_INVOICES, {
          limit: 20,
          sortField,
          sortDirection,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
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
  }, [sortField, sortDirection, startDate, endDate]);

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
        sortField,
        sortDirection,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success && result.data) {
        setSearchResults(result.data);
      }
    } catch (error) {
      console.error('Failed to search:', error);
    } finally {
      setIsSearching(false);
    }
  }, [sortField, sortDirection, startDate, endDate]);

  const debouncedSearch = useDebouncedCallback(searchInvoices, 400);

  // Re-search when sort changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchInvoices(searchQuery);
    }
  }, [sortField, sortDirection, searchInvoices, searchQuery]);

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
      const employeeName = employeeDisplayName(employee);
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
      replaceCurrentTab(`/invoices/${invoice.id}`, { fromListing: true });
    },
    [replaceCurrentTab]
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
        sortable: true,
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
        sortable: true,
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
        sortable: true,
        render: (invoice) => (
          <Badge color={statusColors[invoice.status] || 'gray'} variant="light">
            {statusLabels[invoice.status] || invoice.status}
          </Badge>
        ),
      },
    ],
    []
  );

  // Columns for invoice tables
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
              <ActionIcon variant="subtle" onClick={() => replaceCurrentTab(`/invoices/${invoice.id}`, { fromListing: true })}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [baseColumns, replaceCurrentTab]
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

        {/* Search + Status Filter */}
        <Group gap="sm" align="flex-end">
          <TextInput
            placeholder="Search by invoice number, client name, or reference..."
            leftSection={isSearching ? <Loader size={14} /> : <IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            size="md"
            style={{ flex: 1 }}
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} size="md" />
          <SegmentedControl
            size="md"
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Partial', value: 'partially_paid' },
              { label: 'Paid', value: 'paid' },
              { label: 'Archived', value: 'archived' },
              { label: 'Cancelled', value: 'cancelled' },
            ]}
          />
        </Group>

        {/* Tabs */}
        <Paper withBorder radius="md" p={0}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="recent" leftSection={<IconClock size={16} />}>
                Recent
              </Tabs.Tab>
              <Tabs.Tab value="all" leftSection={<IconArchive size={16} />}>
                All
                {searchQuery.length >= 2 && filteredSearch.length > 0 && (
                  <Badge ml="xs" size="sm" variant="light" color="blue">
                    {filteredSearch.length}
                  </Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

      {/* Recent Tab */}
            <Tabs.Panel value="recent" p="md">
              <DataTable
                columns={viewOnlyColumns}
                data={filteredRecent}
                loading={isLoadingRecent}
                keyField="id"
                onRowClick={handleViewInvoice}
                emptyMessage={statusFilter === 'all' ? 'No recent invoices' : `No ${statusLabels[statusFilter]?.toLowerCase() || statusFilter} invoices`}
                stickyActionsColumn
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
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
                  data={filteredSearch}
                  loading={isSearching}
                  keyField="id"
                  onRowClick={handleViewInvoice}
                  emptyMessage={statusFilter === 'all' ? `No invoices found for "${searchQuery}"` : `No ${statusLabels[statusFilter]?.toLowerCase() || statusFilter} invoices found for "${searchQuery}"`}
                  stickyActionsColumn
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              )}
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
