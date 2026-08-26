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
  ActionIcon,
  Kbd,
  Tooltip,
  Switch,
} from '@mantine/core';
import { useDisclosure, useDebouncedCallback } from '@mantine/hooks';
import {
  IconSearch,
  IconPlus,
  IconClock,
  IconArchive,
  IconEye,
  IconEdit,
  IconFileInvoice,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { PinVerificationModal } from '../../components/auth/PinVerificationModal';
import { SafeEmployee } from '../../contexts/AuthContext';
import { useSpotlight } from '../../contexts/SpotlightContext';
import { DataTable, Column, SortDirection } from '../../components/common/DataTable';
import { DateRangeFilter, DateRangeValue } from '../../components/common/DateRangeFilter';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  clientId: number | null;
  clientName: string | null;
  total: string;
  status: string;
  isArchived: boolean;
  reference: string | null;
  createdAt: string;
}

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export function QuotationsPage() {
  const navigate = useNavigate();
  const { replaceCurrentTab } = useTabContext();
  const { open: openSpotlight } = useSpotlight();
  const [activeTab, setActiveTab] = useState<string | null>('recent');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchivedOnly, setShowArchivedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [accessModalOpen, { open: openAccessModal, close: closeAccessModal }] = useDisclosure(false);
  const [sortField, setSortField] = useState<string>('quoteDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dateRange, setDateRange] = useState<DateRangeValue>([null, null]);
  const [startDate, endDate] = dateRange;

  // Handle sort change
  const handleSort = useCallback((field: string, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Load quotations based on active tab and filters
  const loadQuotations = useCallback(async (params: {
    search?: string;
    includeArchived?: boolean;
    archivedOnly?: boolean;
    page?: number;
    sortField?: string;
    sortDirection?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  } = {}) => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_PAGINATED, {
        search: params.search || undefined,
        includeArchived: params.includeArchived || false,
        archivedOnly: params.archivedOnly || false,
        page: params.page || 1,
        pageSize: 50,
        sortField: params.sortField,
        sortDirection: params.sortDirection,
        startDate: params.startDate || undefined,
        endDate: params.endDate || undefined,
      });
      if (result.success && result.data) {
        setQuotations(result.data.data || []);
        setTotalCount(result.data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load quotations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load quotations when tab or filters change
  useEffect(() => {
    const archivedOnly = activeTab === 'all' && showArchivedOnly;

    loadQuotations({
      search: searchQuery.length >= 2 ? searchQuery : undefined,
      archivedOnly,
      page,
      sortField,
      sortDirection,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [activeTab, showArchivedOnly, page, loadQuotations, searchQuery, sortField, sortDirection, startDate, endDate]);

  // Debounced search
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setPage(1);
    if (query.length >= 2) {
      setActiveTab('all');
    }
  }, 400);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSearch(value);
    },
    [debouncedSearch]
  );

  // Handle salesperson verification for new quotation
  const handleNewQuotation = useCallback(() => {
    openAccessModal();
  }, [openAccessModal]);

  const handleAccessVerified = useCallback(
    (employee: SafeEmployee) => {
      closeAccessModal();
      const employeeName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.code;
      navigate('/quotations/new', {
        state: {
          salespersonId: employee.id,
          salespersonName: employeeName,
        },
      });
    },
    [closeAccessModal, navigate]
  );

  // View quotation
  const handleViewQuotation = useCallback(
    (quotation: Quotation) => {
      replaceCurrentTab(`/quotations/${quotation.id}`, { fromListing: true });
    },
    [replaceCurrentTab]
  );

  // Edit draft quotation
  const handleEditDraft = useCallback(
    (id: number) => {
      navigate(`/quotations/${id}/edit`);
    },
    [navigate]
  );

  // Base columns for all quotation tables
  const baseColumns: Column<Quotation>[] = useMemo(
    () => [
      {
        key: 'quoteNum',
        header: 'Quote #',
        width: 120,
        render: (quotation) => <Text fw={500}>{quotation.quoteNum}</Text>,
      },
      {
        key: 'quoteDate',
        header: 'Date',
        width: 120,
        sortable: true,
        render: (quotation) => formatDate(quotation.quoteDate),
      },
      {
        key: 'clientName',
        header: 'Client',
        render: (quotation) => (
          <Text truncate maw={200}>
            {quotation.clientName || 'Walk-in Customer'}
          </Text>
        ),
      },
      {
        key: 'reference',
        header: 'Reference',
        width: 150,
        render: (quotation) => (
          <Text truncate maw={150} c={quotation.reference ? undefined : 'dimmed'}>
            {quotation.reference || '-'}
          </Text>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        width: 100,
        sortable: true,
        render: (quotation) => <Text ta="right">{formatCurrency(quotation.total)}</Text>,
      },
    ],
    []
  );

  // Columns with actions
  const viewColumns: Column<Quotation>[] = useMemo(
    () => [
      ...baseColumns,
      {
        key: 'actions',
        header: '',
        width: 120,
        render: (quotation) => (
          <Group gap="xs" justify="flex-end">
            <Tooltip label="View">
              <ActionIcon variant="subtle" onClick={() => replaceCurrentTab(`/quotations/${quotation.id}`, { fromListing: true })}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            {quotation.status === 'draft' && (
              <Tooltip label="Edit">
                <ActionIcon variant="subtle" color="blue" onClick={() => handleEditDraft(quotation.id)}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            {(quotation.status === 'draft' || quotation.status === 'sent' || quotation.status === 'accepted') && (
              <Tooltip label="Convert to Invoice">
                <ActionIcon
                  variant="subtle"
                  color="violet"
                  onClick={() => replaceCurrentTab(`/quotations/${quotation.id}`, { fromListing: true })}
                >
                  <IconFileInvoice size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ),
      },
    ],
    [baseColumns, replaceCurrentTab, handleEditDraft]
  );

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={2}>Quotations</Title>
            <Text c="dimmed" size="sm">
              Manage and search quotations
            </Text>
          </Stack>
          <Group gap="sm">
            <Button variant="light" leftSection={<IconSearch size={16} />} onClick={openSpotlight}>
              Quick Search
              <Kbd ml="xs" size="xs">
                Ctrl+K
              </Kbd>
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNewQuotation}>
              New Quotation
            </Button>
          </Group>
        </Group>

        {/* Search */}
        <Group gap="md" align="flex-end">
          <TextInput
            placeholder="Search by quote number, client name, or reference..."
            leftSection={isLoading ? <Loader size={14} /> : <IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            size="md"
            style={{ flex: 1 }}
          />
          <DateRangeFilter
            value={dateRange}
            onChange={(range) => {
              setPage(1);
              setDateRange(range);
            }}
            size="md"
          />
          {activeTab === 'all' && (
            <Switch
              label="Archived only"
              checked={showArchivedOnly}
              onChange={(e) => {
                setPage(1);
                setShowArchivedOnly(e.currentTarget.checked);
              }}
              size="md"
            />
          )}
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
                {activeTab === 'all' && totalCount > 0 && (
                  <Badge ml="xs" size="sm" variant="light" color="blue">
                    {totalCount}
                  </Badge>
                )}
              </Tabs.Tab>
            </Tabs.List>

            {/* Recent Tab */}
            <Tabs.Panel value="recent" p="md">
              <DataTable
                columns={viewColumns}
                data={activeTab === 'recent' ? quotations : []}
                loading={isLoading && activeTab === 'recent'}
                keyField="id"
                onRowClick={handleViewQuotation}
                emptyMessage="No recent quotations"
                stickyActionsColumn
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            </Tabs.Panel>

            {/* All/Search Tab */}
            <Tabs.Panel value="all" p="md">
              <DataTable
                columns={viewColumns}
                data={activeTab === 'all' ? quotations : []}
                loading={isLoading && activeTab === 'all'}
                keyField="id"
                onRowClick={handleViewQuotation}
                emptyMessage={
                  searchQuery.length >= 2
                    ? `No quotations found for "${searchQuery}"`
                    : showArchivedOnly
                      ? 'No archived quotations found'
                      : 'No quotations found'
                }
                stickyActionsColumn
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
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
        description="Enter your access code to create a quotation."
        requiredPermission="CREATE_QUOTE"
      />
    </>
  );
}
