import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig } from './config';
import { MigrationOptions, MigrationResult } from './types/migration.types';
import { ProgressTracker } from './core/progress-tracker';
import { DryRun } from './core/dry-run';
import { ClientsMigrator } from './migrators/clients-migrator';
import { EmployeesMigrator } from './migrators/employees-migrator';
import { LocationsMigrator } from './migrators/locations-migrator';
import { PartsMigrator } from './migrators/parts-migrator';

export class MigrationOrchestrator {
  private options: MigrationOptions;
  private progressTracker: ProgressTracker;
  private dryRun?: DryRun;
  private migrators: Map<string, any>;

  constructor(options: MigrationOptions = {}) {
    this.options = options;
    this.progressTracker = new ProgressTracker(!options.dryRun);

    if (options.dryRun) {
      this.dryRun = new DryRun(`migration-${Date.now()}`);
    }

    // Register all migrators
    this.migrators = new Map([
      ['clients', ClientsMigrator],
      ['employees', EmployeesMigrator],
      ['locations', LocationsMigrator],
      ['parts', PartsMigrator],
      // TODO: Add more migrators as they are implemented
      // ['invoices', InvoicesMigrator],
      // ['quotations', QuotationsMigrator],
      // etc.
    ]);
  }

  /**
   * Run migration
   */
  async run(): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];
    const startTime = Date.now();

    try {
      this.progressTracker.printPhaseHeader(
        'DBF to SQLite Migration',
        this.options.dryRun ? 'Dry Run Mode' : 'Production Mode'
      );

      // Create backup if requested
      if (this.options.backup && !this.options.dryRun) {
        await this.createBackup();
      }

      // Ensure log directories exist
      this.ensureDirectories();

      // Get migrators to run
      const migratorsToRun = this.getMigratorsToRun();

      this.progressTracker.printStep(
        1,
        2,
        `Running ${migratorsToRun.length} migrator(s)...`
      );

      // Run each migrator in order
      for (const [index, migratorName] of migratorsToRun.entries()) {
        const MigratorClass = this.migrators.get(migratorName);

        if (!MigratorClass) {
          this.progressTracker.logWarning(
            `Migrator not found: ${migratorName} - skipping`
          );
          continue;
        }

        try {
          this.progressTracker.log(
            `\n[${index + 1}/${migratorsToRun.length}] Running ${migratorName} migrator...`
          );

          const migrator = new MigratorClass();
          migrator.setProgressTracker(this.progressTracker);

          if (this.dryRun) {
            migrator.setDryRun(this.dryRun);
          }

          const result = await migrator.migrate(this.options);
          results.push(result);

          if (result.error) {
            this.progressTracker.logError(
              `${migratorName} migration failed: ${result.error}`
            );
          } else {
            this.progressTracker.logSuccess(
              `${migratorName}: ${result.successCount}/${result.totalRecords} records migrated`
            );
          }
        } catch (error) {
          this.progressTracker.logError(
            `Failed to run ${migratorName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );

          results.push({
            tableName: migratorName,
            totalRecords: 0,
            successCount: 0,
            errorCount: 1,
            skippedCount: 0,
            warningCount: 0,
            elapsedTime: 0,
            dryRun: this.options.dryRun || false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Save dry run report if applicable
      if (this.dryRun) {
        this.progressTracker.printStep(2, 2, 'Generating dry run report...');

        const jsonPath = await this.dryRun.saveDryRunReport();
        const mdPath = await this.dryRun.saveMarkdownReport();

        this.progressTracker.logSuccess(`Dry run JSON report: ${jsonPath}`);
        this.progressTracker.logSuccess(`Dry run Markdown report: ${mdPath}`);

        this.dryRun.printSummary();
      }

      // Print final summary
      const elapsedTime = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsedTime / 1000);

      this.progressTracker.printSummary({
        totalFiles: migratorsToRun.length,
        totalRecords: results.reduce((sum, r) => sum + r.totalRecords, 0),
        successRecords: results.reduce((sum, r) => sum + r.successCount, 0),
        errorRecords: results.reduce((sum, r) => sum + r.errorCount, 0),
        warningCount: results.reduce((sum, r) => sum + r.warningCount, 0),
        skippedRecords: results.reduce((sum, r) => sum + r.skippedCount, 0),
      });

      this.progressTracker.stop();

      return results;
    } catch (error) {
      this.progressTracker.logError(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      this.progressTracker.stop();
      throw error;
    }
  }

  /**
   * Get list of migrators to run based on options
   */
  private getMigratorsToRun(): string[] {
    // If specific migrator requested, run only that one
    if (this.options.migrator) {
      if (this.migrators.has(this.options.migrator)) {
        return [this.options.migrator];
      } else {
        throw new Error(`Unknown migrator: ${this.options.migrator}`);
      }
    }

    // Otherwise, run all migrators in configured order
    return MigrationConfig.migrationOrder.filter((name) => this.migrators.has(name));
  }

  /**
   * Create database backup
   */
  private async createBackup(): Promise<void> {
    this.progressTracker.printStep(1, 2, 'Creating database backup...');

    const dbPath = MigrationConfig.dbPath;

    if (!fs.existsSync(dbPath)) {
      this.progressTracker.logWarning('Database file not found - skipping backup');
      return;
    }

    const backupDir = path.join(MigrationConfig.logsPath, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);

    fs.copyFileSync(dbPath, backupPath);

    this.progressTracker.logSuccess(`Backup created: ${backupPath}`);
  }

  /**
   * Ensure all log directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      MigrationConfig.logsPath,
      MigrationConfig.analysisPath,
      MigrationConfig.dryRunPath,
      MigrationConfig.errorsPath,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Get available migrators
   */
  getAvailableMigrators(): string[] {
    return Array.from(this.migrators.keys());
  }
}
