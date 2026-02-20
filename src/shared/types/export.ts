export type ExportFormat = 'csv' | 'xlsx';

export interface ExportColumn {
  header: string;
  key: string;
  format?: 'currency' | 'number' | 'date' | 'text';
}

export interface ExportRequest {
  fileName: string;
  format: ExportFormat;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  sheetName?: string;
}

export interface ExportResult {
  filePath?: string;
  cancelled?: boolean;
}
