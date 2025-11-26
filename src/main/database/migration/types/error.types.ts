// Error handling types

export interface ErrorLog {
  migrationId: string;
  timestamp: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  errors: ErrorEntry[];
}

export interface ErrorEntry {
  severity: 'warning' | 'error' | 'fatal';
  migrator: string;
  dbfFile: string;
  recordIndex: number;
  recordId?: string | number;
  field?: string;
  message: string;
  originalValue?: any;
  expectedType?: string;
  actualType?: string;
  stackTrace?: string;
  timestamp: string;
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly severity: 'warning' | 'error' | 'fatal',
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}
