import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig } from '../config';
import { ErrorLog, ErrorEntry, MigrationError } from '../types/error.types';

export class ErrorHandler {
  private errors: ErrorEntry[] = [];
  private warnings: ErrorEntry[] = [];
  private migrationId: string;
  private totalRecords: number = 0;
  private successCount: number = 0;

  constructor(migrationId: string) {
    this.migrationId = migrationId;
    this.ensureErrorsDirectory();
  }

  /**
   * Log an error
   */
  logError(
    migrator: string,
    dbfFile: string,
    recordIndex: number,
    message: string,
    options: {
      recordId?: string | number;
      field?: string;
      originalValue?: any;
      expectedType?: string;
      actualType?: string;
      severity?: 'warning' | 'error' | 'fatal';
      stackTrace?: string;
    } = {}
  ): void {
    const entry: ErrorEntry = {
      severity: options.severity || 'error',
      migrator,
      dbfFile,
      recordIndex,
      recordId: options.recordId,
      field: options.field,
      message,
      originalValue: options.originalValue,
      expectedType: options.expectedType,
      actualType: options.actualType,
      stackTrace: options.stackTrace,
      timestamp: new Date().toISOString(),
    };

    if (entry.severity === 'warning') {
      this.warnings.push(entry);
    } else {
      this.errors.push(entry);
    }
  }

  /**
   * Log a warning
   */
  logWarning(
    migrator: string,
    dbfFile: string,
    recordIndex: number,
    message: string,
    options: {
      recordId?: string | number;
      field?: string;
      originalValue?: any;
    } = {}
  ): void {
    this.logError(migrator, dbfFile, recordIndex, message, {
      ...options,
      severity: 'warning',
    });
  }

  /**
   * Log validation error
   */
  logValidationError(
    migrator: string,
    dbfFile: string,
    recordIndex: number,
    field: string,
    message: string,
    originalValue?: any
  ): void {
    this.logError(migrator, dbfFile, recordIndex, `Validation failed: ${message}`, {
      field,
      originalValue,
      severity: 'error',
    });
  }

  /**
   * Log transformation error
   */
  logTransformError(
    migrator: string,
    dbfFile: string,
    recordIndex: number,
    field: string,
    message: string,
    originalValue?: any,
    expectedType?: string
  ): void {
    this.logError(migrator, dbfFile, recordIndex, `Transform failed: ${message}`, {
      field,
      originalValue,
      expectedType,
      actualType: typeof originalValue,
      severity: 'error',
    });
  }

  /**
   * Log database insertion error
   */
  logInsertError(
    migrator: string,
    dbfFile: string,
    recordIndex: number,
    message: string,
    recordId?: string | number,
    stackTrace?: string
  ): void {
    this.logError(migrator, dbfFile, recordIndex, `Insert failed: ${message}`, {
      recordId,
      severity: 'fatal',
      stackTrace,
    });
  }

  /**
   * Update statistics
   */
  updateStats(total: number, success: number): void {
    this.totalRecords = total;
    this.successCount = success;
  }

  /**
   * Check if error threshold exceeded
   */
  isThresholdExceeded(): boolean {
    return this.errors.length >= MigrationConfig.maxErrorsBeforeAbort;
  }

  /**
   * Get error count
   */
  getErrorCount(): number {
    return this.errors.length;
  }

  /**
   * Get warning count
   */
  getWarningCount(): number {
    return this.warnings.length;
  }

  /**
   * Get all errors
   */
  getErrors(): ErrorEntry[] {
    return [...this.errors];
  }

  /**
   * Get all warnings
   */
  getWarnings(): ErrorEntry[] {
    return [...this.warnings];
  }

  /**
   * Save error log to file
   */
  async saveErrorLog(): Promise<string> {
    const errorLog: ErrorLog = {
      migrationId: this.migrationId,
      timestamp: new Date().toISOString(),
      totalRecords: this.totalRecords,
      successCount: this.successCount,
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: [...this.errors, ...this.warnings].sort(
        (a, b) => a.recordIndex - b.recordIndex
      ),
    };

    const fileName = `error-log-${this.migrationId}-${Date.now()}.json`;
    const filePath = path.join(MigrationConfig.errorsPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(errorLog, null, 2));

    return filePath;
  }

  /**
   * Generate error summary report
   */
  generateSummary(): string {
    const total = this.errors.length + this.warnings.length;
    if (total === 0) {
      return 'No errors or warnings';
    }

    let summary = `\n📋 Error Summary:\n`;
    summary += `   Total Issues: ${total}\n`;
    summary += `   Errors: ${this.errors.length}\n`;
    summary += `   Warnings: ${this.warnings.length}\n`;

    // Group by migrator
    const byMigrator = this.groupBy([...this.errors, ...this.warnings], 'migrator');
    summary += `\n   By Migrator:\n`;
    for (const [migrator, entries] of Object.entries(byMigrator)) {
      summary += `     ${migrator}: ${entries.length} issues\n`;
    }

    // Group by severity
    const bySeverity = this.groupBy([...this.errors, ...this.warnings], 'severity');
    summary += `\n   By Severity:\n`;
    for (const [severity, entries] of Object.entries(bySeverity)) {
      summary += `     ${severity}: ${entries.length}\n`;
    }

    return summary;
  }

  /**
   * Generate detailed error report (Markdown)
   */
  generateDetailedReport(): string {
    let report = `# Migration Error Report\n\n`;
    report += `**Migration ID:** ${this.migrationId}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Records: ${this.totalRecords}\n`;
    report += `- Successful: ${this.successCount}\n`;
    report += `- Failed: ${this.totalRecords - this.successCount}\n`;
    report += `- Errors: ${this.errors.length}\n`;
    report += `- Warnings: ${this.warnings.length}\n\n`;

    report += `## Errors\n\n`;
    if (this.errors.length > 0) {
      report += this.formatErrorsTable(this.errors);
    } else {
      report += `No errors recorded.\n\n`;
    }

    report += `## Warnings\n\n`;
    if (this.warnings.length > 0) {
      report += this.formatErrorsTable(this.warnings);
    } else {
      report += `No warnings recorded.\n\n`;
    }

    return report;
  }

  /**
   * Format errors as markdown table
   */
  private formatErrorsTable(entries: ErrorEntry[]): string {
    let table = `| Migrator | DBF File | Record | Field | Message |\n`;
    table += `|----------|----------|--------|-------|----------|\n`;

    for (const entry of entries) {
      table += `| ${entry.migrator} | ${entry.dbfFile} | ${entry.recordIndex} | ${entry.field || '-'} | ${entry.message} |\n`;
    }

    table += `\n`;
    return table;
  }

  /**
   * Group entries by field
   */
  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce(
      (groups, item) => {
        const value = String(item[key]);
        if (!groups[value]) {
          groups[value] = [];
        }
        groups[value].push(item);
        return groups;
      },
      {} as Record<string, T[]>
    );
  }

  /**
   * Ensure errors directory exists
   */
  private ensureErrorsDirectory(): void {
    if (!fs.existsSync(MigrationConfig.errorsPath)) {
      fs.mkdirSync(MigrationConfig.errorsPath, { recursive: true });
    }
  }

  /**
   * Clear all errors and warnings
   */
  clear(): void {
    this.errors = [];
    this.warnings = [];
    this.totalRecords = 0;
    this.successCount = 0;
  }
}
