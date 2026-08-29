import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Tabs,
  Badge,
  TextInput,
  Loader,
  Center,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch, IconClock, IconArchive, IconEye } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';
import { DataTable, Column, SortDirection } from '../../components/common/DataTable';

interface CreditNote {
  id: number;
  crNumber: string;
  invNumber: string | null;
  crDate: string;
  clientId: number | null;
  clientName: string | null;
  total: string;
  totalUsed: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  A: 'green',
  U: 'gray',
};

const statusLabels: Record<string, string> = {
  A: 'Active',
  U: 'Used',
};

const formatCurrency = (value: string | null) => {
  const num = parseFloat(value || '0');
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export function CreditNotesPage() {
  const { openTab, replaceCurrentTab } = useTabContext();
  const [activeTab, setActiveTab] = useState<string | null>('recent');
  const [recentNotes, setRecentNotes] = useState<CreditNote[]>([]);
  const [searchResults, setSearchResults] = useState<CreditNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [sortField, setSortField] = useState<string>('crDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = useCallback((field: string, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Load recent credit notes
  useEffect(() => {
    const loadRecent = async () => {
      setIsLoadingRecent(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_PAGINATED, {
          page: 1,
          pageSize: 20,
          includeArchived: false,
        });
        if (result.success && result.data) {
          setRecentNotes(result.data.data ?? []);
        }
      } catch (error) {
        console.error('Failed to load recent credit notes:', error);
      } finally {
        setIsLoadingRecent(false);
      }
    };
    loadRecent();
  }, [sortField, sortDirection]);

  // Search credit notes
  const searchNotes = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTES_PAGINATED, {
        page: 1,
        pageSize: 50,
        search: query,
        includeArchived: true,
      });
      if (result.success && result.data) {
        setSearchResults(result.data.data ?? []);
      }
    } catch (error) {
      console.error('Failed to search credit notes:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback(searchNotes, 400);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchNotes(searchQuery);
    }
  }, [sortField, sortDirection, searchNotes, searchQuery]);

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

  const handleViewNote = useCallback(
    (note: CreditNote) => {
      replaceCurrentTab(`/credit-notes/${note.id}`);
    },
    [replaceCurrentTab]
  );

  const baseColumns: Column<CreditNote>[] = useMemo(
    () => [
      {
        key: 'crNumber',
        header: 'CR #',
        width: 120,
        render: (note) => <Text fw={500}>{note.crNumber}</Text>,
      },
      {
        key: 'invNumber',
        header: 'Invoice #',
        width: 120,
        render: (note) => <Text size="sm">{note.invNumber || '-'}</Text>,
      },
      {
        key: 'crDate',
        header: 'Date',
        width: 120,
        sortable: true,
        render: (note) => formatDate(note.crDate),
      },
      {
        key: 'clientName',
        header: 'Client',
        render: (note) => (
          <Text truncate maw={200}>
            {note.clientName || '-'}
          </Text>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        width: 110,
        sortable: true,
        render: (note) => <Text ta="right">{formatCurrency(note.total)}</Text>,
      },
      {
        key: 'balance',
        header: 'Remaining',
        width: 110,
        render: (note) => {
          const balance = parseFloat(note.total) - parseFloat(note.totalUsed);
          return (
            <Text ta="right" c={balance > 0 ? 'green' : 'dimmed'}>
              {formatCurrency(balance.toString())}
            </Text>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: 90,
        render: (note) => {
          const effectiveStatus = note.isArchived ? 'archived' : note.status;
          return (
            <Badge color={effectiveStatus === 'archived' ? 'gray' : statusColors[note.status] || 'gray'} variant="light">
              {effectiveStatus === 'archived' ? 'Archived' : statusLabels[note.status] || note.status}
            </Badge>
          );
        },
      },
    ],
    []
  );

  const columns: Column<CreditNote>[] = useMemo(
    () => [
      ...baseColumns,
      {
        key: 'actions',
        header: '',
        width: 50,
        render: (note) => (
          <Group gap="xs" justify="flex-end">
            <Tooltip label="View">
              <ActionIcon variant="subtle" onClick={() => openTab(`/credit-notes/${note.id}`)}>
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
      },
    ],
    [baseColumns, openTab]
  );

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>Credit Notes</Title>
          <Text c="dimmed" size="sm">
            View and manage issued credit notes
          </Text>
        </Stack>
      </Group>

      {/* Search */}
      <TextInput
        placeholder="Search by CR number, invoice number, or client name..."
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
          </Tabs.List>

          <Tabs.Panel value="recent" p="md">
            <DataTable
              columns={columns}
              data={recentNotes}
              loading={isLoadingRecent}
              keyField="id"
              onRowClick={handleViewNote}
              emptyMessage="No recent credit notes"
              stickyActionsColumn
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          </Tabs.Panel>

          <Tabs.Panel value="all" p="md">
            {searchQuery.length < 2 ? (
              <Center py="xl">
                <Stack align="center" gap="sm">
                  <IconSearch size={32} color="var(--mantine-color-dimmed)" />
                  <Text c="dimmed" size="sm" ta="center">
                    Enter at least 2 characters to search all credit notes
                  </Text>
                </Stack>
              </Center>
            ) : (
              <DataTable
                columns={columns}
                data={searchResults}
                loading={isSearching}
                keyField="id"
                onRowClick={handleViewNote}
                emptyMessage={`No credit notes found for "${searchQuery}"`}
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
  );
}
