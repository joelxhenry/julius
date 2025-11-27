import { Table, ScrollArea, TextInput, Skeleton, Stack, Pagination, Center, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useState, useMemo } from 'react';

export interface ColumnDef<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  width?: string | number;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface RowClickOptions {
  newTab?: boolean; // Whether to open in new tab (Ctrl+click or middle-click)
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  loadingRows?: number;
  onRowClick?: (row: T, options?: RowClickOptions) => void;
  selectable?: boolean;
  pagination?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  keyboardNav?: boolean;
  emptyMessage?: string;
  rowKey?: keyof T; // Unique key for row identification
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  loadingRows = 5,
  onRowClick,
  pagination = false,
  pageSize = 20,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data found',
  rowKey,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Get searchable column keys for efficient filtering
  const searchableKeys = useMemo(() => columns.map((col) => col.key), [columns]);

  // Filter data based on debounced search - only search displayed columns
  const filteredData = useMemo(() => {
    if (!debouncedSearch) return data;

    const lowerSearch = debouncedSearch.toLowerCase();
    return data.filter((row) =>
      searchableKeys.some((key) => {
        const value = row[key as keyof T];
        return value != null && String(value).toLowerCase().includes(lowerSearch);
      })
    );
  }, [data, debouncedSearch, searchableKeys]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;

      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortKey, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, pagination, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (row: T, event: React.MouseEvent) => {
    if (onRowClick) {
      // Detect Ctrl+click, Cmd+click (Mac), or middle-click
      const newTab = event.ctrlKey || event.metaKey || event.button === 1;
      onRowClick(row, { newTab });
    }
  };

  const handleRowMouseDown = (row: T, event: React.MouseEvent) => {
    // Handle middle-click (button === 1)
    if (event.button === 1 && onRowClick) {
      event.preventDefault();
      onRowClick(row, { newTab: true });
    }
  };

  if (loading) {
    return (
      <Stack>
        {searchable && <Skeleton height={36} />}
        {Array.from({ length: loadingRows }).map((_, i) => (
          <Skeleton key={i} height={50} />
        ))}
      </Stack>
    );
  }

  if (!loading && data.length === 0) {
    return (
      <Center p="xl">
        <Text c="dimmed">{emptyMessage}</Text>
      </Center>
    );
  }

  return (
    <Stack>
      {searchable && (
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      <ScrollArea>
        <Table highlightOnHover={!!onRowClick} striped>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th
                  key={String(column.key)}
                  style={{
                    width: column.width,
                    cursor: column.sortable ? 'pointer' : 'default',
                  }}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  {column.title}
                  {column.sortable && sortKey === column.key && (
                    <span> {sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedData.map((row, index) => {
              const key = rowKey ? String(row[rowKey]) : index;
              return (
                <Table.Tr
                  key={key}
                  onClick={(e) => handleRowClick(row, e)}
                  onMouseDown={(e) => handleRowMouseDown(row, e)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => {
                    const value = row[column.key as keyof T];
                    return (
                      <Table.Td key={String(column.key)}>
                        {column.render ? column.render(value, row) : String(value ?? '')}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {pagination && totalPages > 1 && (
        <Center>
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={setCurrentPage}
          />
        </Center>
      )}
    </Stack>
  );
}
