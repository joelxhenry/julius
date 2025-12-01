import { ReactNode } from 'react';
import {
  Table,
  Text,
  Skeleton,
  Pagination,
  Group,
  Stack,
  Paper,
  Center,
} from '@mantine/core';

export interface Column<T> {
  key: string;
  header: string;
  width?: number | string;
  render?: (row: T) => ReactNode;
  accessor?: keyof T;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  minWidth?: number;
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  // Loading skeleton
  skeletonRows?: number;
  // Sticky actions column
  stickyActionsColumn?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  keyField,
  onRowClick,
  emptyMessage = 'No data found',
  minWidth = 800,
  page,
  totalPages,
  onPageChange,
  skeletonRows = 5,
  stickyActionsColumn = false,
}: DataTableProps<T>) {
  const renderCellContent = (column: Column<T>, row: T): ReactNode => {
    if (column.render) {
      return column.render(row);
    }
    if (column.accessor) {
      const value = row[column.accessor];
      if (value === null || value === undefined) {
        return '-';
      }
      return String(value);
    }
    return '-';
  };

  const renderSkeletonRows = () => {
    return Array.from({ length: skeletonRows }).map((_, index) => (
      <Table.Tr key={`skeleton-${index}`}>
        {columns.map((column) => (
          <Table.Td key={column.key}>
            <Skeleton height={20} />
          </Table.Td>
        ))}
      </Table.Tr>
    ));
  };

  const renderEmptyRow = () => (
    <Table.Tr>
      <Table.Td colSpan={columns.length}>
        <Text c="dimmed" ta="center" py="xl">
          {emptyMessage}
        </Text>
      </Table.Td>
    </Table.Tr>
  );

  const renderDataRows = () => {
    return data.map((row) => {
      const key = String(row[keyField]);
      const isClickable = Boolean(onRowClick);
      const lastColumnIndex = columns.length - 1;

      return (
        <Table.Tr
          key={key}
          style={isClickable ? { cursor: 'pointer' } : undefined}
          onClick={isClickable ? () => onRowClick!(row) : undefined}
        >
          {columns.map((column, columnIndex) => {
            const isActionsColumn = stickyActionsColumn && columnIndex === lastColumnIndex;
            return (
              <Table.Td
                key={column.key}
                style={column.width ? { width: column.width } : undefined}
                onClick={isActionsColumn ? (e) => e.stopPropagation() : undefined}
              >
                {renderCellContent(column, row)}
              </Table.Td>
            );
          })}
        </Table.Tr>
      );
    });
  };

  return (
    <Stack gap="md">
      <Table.ScrollContainer minWidth={minWidth}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading
              ? renderSkeletonRows()
              : data.length === 0
                ? renderEmptyRow()
                : renderDataRows()}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {totalPages !== undefined && totalPages > 1 && onPageChange && (
        <Center>
          <Pagination
            total={totalPages}
            value={page}
            onChange={onPageChange}
            size="sm"
          />
        </Center>
      )}
    </Stack>
  );
}
