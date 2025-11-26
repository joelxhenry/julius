import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig } from './config';
import { MigrationOptions, MigrationResult } from './types/migration.types';
import { ProgressTracker } from './core/progress-tracker';
import { DryRun } from './core/dry-run';
import { ForeignKeyLookup } from './core/foreign-key-lookup';
import { ClientsMigrator } from './migrators/clients-migrator';
import { EmployeesMigrator } from './migrators/employees-migrator';
import { PartsMigrator } from './migrators/parts-migrator';
import { PartVariantsMigrator } from './migrators/part-variants-migrator';
import { PaymentMethodsMigrator } from './migrators/payment-methods-migrator';
import { SettingsMigrator } from './migrators/settings-migrator';
import { InvoicesMigrator } from './migrators/invoices-migrator';
import { HistoricalInvoicesMigrator } from './migrators/historical-invoices-migrator';
import { InvoiceItemsMigrator } from './migrators/invoice-items-migrator';
import { HistoricalInvoiceItemsMigrator } from './migrators/historical-invoice-items-migrator';
import { PaymentsMigrator } from './migrators/payments-migrator';
import { HistoricalPaymentsMigrator } from './migrators/historical-payments-migrator';

export class MigrationOrchestrator {
  private options: MigrationOptions;
  private progressTracker: ProgressTracker;
  private dryRun?: DryRun;
  private fkLookup: ForeignKeyLookup;
  private migrators: Map<string, any>;

  constructor(options: MigrationOptions = {}) {
    this.options = options;
    this.progressTracker = new ProgressTracker(!options.dryRun);
    this.fkLookup = new ForeignKeyLookup();

    if (options.dryRun) {
      this.dryRun = new DryRun(`migration-${Date.now()}`);
      this.fkLookup.setDryRun(true);
    }

    // Register all migrators
    // Note: Migrators that need FK lookup will receive it as constructor parameter
    this.migrators = new Map([
      ['clients', { class: ClientsMigrator, needsFkLookup: false }],
      ['employees', { class: EmployeesMigrator, needsFkLookup: false }],
      ['payment-methods', { class: PaymentMethodsMigrator, needsFkLookup: false }],
      ['settings', { class: SettingsMigrator, needsFkLookup: false }],
      ['parts', { class: PartsMigrator, needsFkLookup: false }],
      ['part-variants', { class: PartVariantsMigrator, needsFkLookup: true }],
      ['invoices', { class: InvoicesMigrator, needsFkLookup: true }],
      ['historical-invoices', { class: HistoricalInvoicesMigrator, needsFkLookup: true }],
      ['invoice-items', { class: InvoiceItemsMigrator, needsFkLookup: true }],
      ['historical-invoice-items', { class: HistoricalInvoiceItemsMigrator, needsFkLookup: true }],
      ['payments', { class: PaymentsMigrator, needsFkLookup: true }],
      ['historical-payments', { class: HistoricalPaymentsMigrator, needsFkLookup: true }]
    ]);
  }

  /**
   * Initialize foreign key lookup cache
   */
  private async initializeForeignKeyLookup(): Promise<void> {
    this.progressTracker.printStep(1, 3, 'Initializing foreign key lookup cache...');

    try {
      // Load master data for FK resolution
      await this.fkLookup.loadClients();
      await this.fkLookup.loadEmployees();
      await this.fkLookup.loadParts();
      await this.fkLookup.loadPartVariants();

      // Display cache statistics
      const stats = this.fkLookup.getStats();
      this.progressTracker.logSuccess(
        `FK cache loaded: ${stats.clients} clients, ${stats.employees} employees, ${stats.parts} parts, ${stats.partVariants} part variants`
      );
    } catch (error) {
      this.progressTracker.logError(
        `Failed to initialize FK lookup: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw error;
    }
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
      // FK lookup cache is initialized after master tables are migrated
      let fkLookupInitialized = false;

      for (const [index, migratorName] of migratorsToRun.entries()) {
        const migratorConfig = this.migrators.get(migratorName);

        if (!migratorConfig) {
          this.progressTracker.logWarning(
            `Migrator not found: ${migratorName} - skipping`
          );
          continue;
        }

        // Initialize FK lookup before first migrator that needs it
        // This ensures master data (clients, employees, parts, locations) is already migrated
        if (migratorConfig.needsFkLookup && !fkLookupInitialized) {
          await this.initializeForeignKeyLookup();
          fkLookupInitialized = true;
        }

        try {
          this.progressTracker.log(
            `\n[${index + 1}/${migratorsToRun.length}] Running ${migratorName} migrator...`
          );

          // Instantiate migrator with or without FK lookup
          const migrator = migratorConfig.needsFkLookup
            ? new migratorConfig.class(this.fkLookup)
            : new migratorConfig.class();

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
    // This ensures master tables (clients, employees, parts, locations) are migrated
    // before dependent tables (invoices, quotations, credit notes)
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
