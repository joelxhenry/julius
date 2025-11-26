// Migration types

export interface MigrationOptions {
  dryRun?: boolean;
  strict?: boolean;
  backup?: boolean;
  migrator?: string;
}

export interface MigrationResult {
  tableName?: string;
  totalRecords: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  warningCount: number;
  elapsedTime: number;
  dryRun: boolean;
  error?: string;
}

export interface MigrationError {
  severity: ErrorSeverity;
  migrator: string;
  dbfFile: string;
  recordIndex: number;
  recordId?: string | number;
  field?: string;
  message: string;
  originalValue?: any;
  stackTrace?: string;
  timestamp: string;
}

export enum ErrorSeverity {
  WARNING = 'warning',
  ERROR = 'error',
  FATAL = 'fatal',
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FieldMapping {
  source: string;
  target: string;
  type: 'string' | 'integer' | 'real' | 'boolean' | 'date';
  required: boolean;
  transform?: (value: any) => any;
  validate?: (value: any) => boolean;
  default?: any;
}

export interface TableMapping {
  dbfFile: string;
  targetTable: string;
  fields: FieldMapping[];
}
