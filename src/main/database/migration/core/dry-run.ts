import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig } from '../config';

export interface DryRunRecord {
  tableName: string;
  recordIndex: number;
  sourceRecord: any;
  transformedRecord: any;
  validationResult: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export interface DryRunSummary {
  migrationId: string;
  timestamp: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  recordsWithWarnings: number;
  tableBreakdown: Record<
    string,
    {
      total: number;
      valid: number;
      invalid: number;
      warnings: number;
    }
  >;
  sampleRecords: DryRunRecord[];
}

export class DryRun {
  private records: DryRunRecord[] = [];
  private migrationId: string;
  private maxSampleSize: number = 10;

  constructor(migrationId: string, maxSampleSize: number = 10) {
    this.migrationId = migrationId;
    this.maxSampleSize = maxSampleSize;
    this.ensureDryRunDirectory();
  }

  /**
   * Add a record to the dry run
   */
  addRecord(
    tableName: string,
    recordIndex: number,
    sourceRecord: any,
    transformedRecord: any,
    validationResult: {
      valid: boolean;
      errors: string[];
      warnings: string[];
    }
  ): void {
    this.records.push({
      tableName,
      recordIndex,
      sourceRecord,
      transformedRecord,
      validationResult,
    });
  }

  /**
   * Generate dry run summary
   */
  generateSummary(): DryRunSummary {
    const validRecords = this.records.filter((r) => r.validationResult.valid).length;
    const invalidRecords = this.records.filter((r) => !r.validationResult.valid).length;
    const recordsWithWarnings = this.records.filter(
      (r) => r.validationResult.warnings.length > 0
    ).length;

    // Group by table
    const tableBreakdown: Record<string, any> = {};
    for (const record of this.records) {
      if (!tableBreakdown[record.tableName]) {
        tableBreakdown[record.tableName] = {
          total: 0,
          valid: 0,
          invalid: 0,
          warnings: 0,
        };
      }

      tableBreakdown[record.tableName].total++;
      if (record.validationResult.valid) {
        tableBreakdown[record.tableName].valid++;
      } else {
        tableBreakdown[record.tableName].invalid++;
      }
      if (record.validationResult.warnings.length > 0) {
        tableBreakdown[record.tableName].warnings++;
      }
    }

    // Get sample records (mix of valid, invalid, and with warnings)
    const sampleRecords = this.getSampleRecords();

    return {
      migrationId: this.migrationId,
      timestamp: new Date().toISOString(),
      totalRecords: this.records.length,
      validRecords,
      invalidRecords,
      recordsWithWarnings,
      tableBreakdown,
      sampleRecords,
    };
  }

  /**
   * Get sample records for preview
   */
  private getSampleRecords(): DryRunRecord[] {
    const samples: DryRunRecord[] = [];

    // Get some invalid records
    const invalidRecords = this.records.filter((r) => !r.validationResult.valid);
    samples.push(...invalidRecords.slice(0, Math.ceil(this.maxSampleSize / 3)));

    // Get some records with warnings
    const warningRecords = this.records.filter(
      (r) => r.validationResult.valid && r.validationResult.warnings.length > 0
    );
    samples.push(...warningRecords.slice(0, Math.ceil(this.maxSampleSize / 3)));

    // Get some valid records
    const validRecords = this.records.filter(
      (r) => r.validationResult.valid && r.validationResult.warnings.length === 0
    );
    samples.push(...validRecords.slice(0, Math.ceil(this.maxSampleSize / 3)));

    return samples.slice(0, this.maxSampleSize);
  }

  /**
   * Save dry run results to file
   */
  async saveDryRunReport(): Promise<string> {
    const summary = this.generateSummary();

    const fileName = `dry-run-${this.migrationId}-${Date.now()}.json`;
    const filePath = path.join(MigrationConfig.dryRunPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));

    return filePath;
  }

  /**
   * Generate Markdown report
   */
  generateMarkdownReport(): string {
    const summary = this.generateSummary();

    let report = `# Dry Run Report\n\n`;
    report += `**Migration ID:** ${summary.migrationId}\n`;
    report += `**Generated:** ${summary.timestamp}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Records: ${summary.totalRecords}\n`;
    report += `- Valid Records: ${summary.validRecords} (${this.percentage(summary.validRecords, summary.totalRecords)}%)\n`;
    report += `- Invalid Records: ${summary.invalidRecords} (${this.percentage(summary.invalidRecords, summary.totalRecords)}%)\n`;
    report += `- Records with Warnings: ${summary.recordsWithWarnings}\n\n`;

    report += `## Table Breakdown\n\n`;
    report += `| Table | Total | Valid | Invalid | Warnings |\n`;
    report += `|-------|-------|-------|---------|----------|\n`;
    for (const [tableName, stats] of Object.entries(summary.tableBreakdown)) {
      report += `| ${tableName} | ${stats.total} | ${stats.valid} | ${stats.invalid} | ${stats.warnings} |\n`;
    }
    report += `\n`;

    report += `## Sample Records\n\n`;
    for (const record of summary.sampleRecords) {
      report += `### ${record.tableName} - Record ${record.recordIndex}\n\n`;

      report += `**Status:** ${record.validationResult.valid ? '✓ Valid' : '✗ Invalid'}\n\n`;

      if (record.validationResult.errors.length > 0) {
        report += `**Errors:**\n`;
        for (const error of record.validationResult.errors) {
          report += `- ${error}\n`;
        }
        report += `\n`;
      }

      if (record.validationResult.warnings.length > 0) {
        report += `**Warnings:**\n`;
        for (const warning of record.validationResult.warnings) {
          report += `- ${warning}\n`;
        }
        report += `\n`;
      }

      report += `**Source Record:**\n`;
      report += `\`\`\`json\n`;
      report += JSON.stringify(record.sourceRecord, null, 2);
      report += `\n\`\`\`\n\n`;

      report += `**Transformed Record:**\n`;
      report += `\`\`\`json\n`;
      report += JSON.stringify(record.transformedRecord, null, 2);
      report += `\n\`\`\`\n\n`;

      report += `---\n\n`;
    }

    return report;
  }

  /**
   * Save Markdown report
   */
  async saveMarkdownReport(): Promise<string> {
    const report = this.generateMarkdownReport();

    const fileName = `dry-run-${this.migrationId}-${Date.now()}.md`;
    const filePath = path.join(MigrationConfig.dryRunPath, fileName);

    fs.writeFileSync(filePath, report);

    return filePath;
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const summary = this.generateSummary();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                     DRY RUN SUMMARY                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log(`  Total Records:           ${summary.totalRecords}`);
    console.log(`  Valid Records:           ${summary.validRecords} (${this.percentage(summary.validRecords, summary.totalRecords)}%)`);
    console.log(`  Invalid Records:         ${summary.invalidRecords} (${this.percentage(summary.invalidRecords, summary.totalRecords)}%)`);
    console.log(`  Records with Warnings:   ${summary.recordsWithWarnings}\n`);

    console.log('  Table Breakdown:');
    console.log('  ─────────────────────────────────────────────────────────');
    for (const [tableName, stats] of Object.entries(summary.tableBreakdown)) {
      const successRate = this.percentage(stats.valid, stats.total);
      console.log(`    ${tableName.padEnd(20)} ${stats.total.toString().padStart(5)} records  (${successRate}% valid)`);
    }

    console.log('\n  Sample Records:');
    console.log('  ─────────────────────────────────────────────────────────');
    for (const record of summary.sampleRecords.slice(0, 3)) {
      const status = record.validationResult.valid ? '✓' : '✗';
      console.log(`    ${status} ${record.tableName} - Record ${record.recordIndex}`);
      if (record.validationResult.errors.length > 0) {
        console.log(`      Errors: ${record.validationResult.errors.length}`);
      }
      if (record.validationResult.warnings.length > 0) {
        console.log(`      Warnings: ${record.validationResult.warnings.length}`);
      }
    }

    console.log('\n╚═══════════════════════════════════════════════════════════╝\n');
  }

  /**
   * Calculate percentage
   */
  private percentage(part: number, total: number): string {
    if (total === 0) return '0.0';
    return ((part / total) * 100).toFixed(1);
  }

  /**
   * Ensure dry run directory exists
   */
  private ensureDryRunDirectory(): void {
    if (!fs.existsSync(MigrationConfig.dryRunPath)) {
      fs.mkdirSync(MigrationConfig.dryRunPath, { recursive: true });
    }
  }

  /**
   * Clear all records
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Get total record count
   */
  getRecordCount(): number {
    return this.records.length;
  }
}
