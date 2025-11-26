import { DBFReader } from '../core/dbf-reader';
import { Validator } from '../core/validator';
import { Transformer } from '../core/transformer';
import { ErrorHandler } from '../core/error-handler';
import { ProgressTracker } from '../core/progress-tracker';
import { DryRun } from '../core/dry-run';
import { MigrationConfig } from '../config';
import {
  MigrationOptions,
  MigrationResult,
  FieldMapping,
  TableMapping,
} from '../types/migration.types';
import { DBFRecord } from '../types/dbf.types';
import { db } from '../../index';

export abstract class BaseMigrator {
  protected dbfReader: DBFReader;
  protected validator: Validator;
  protected transformer: Transformer;
  protected errorHandler: ErrorHandler;
  protected progressTracker?: ProgressTracker;
  protected dryRun?: DryRun;

  protected tableName: string;
  protected dbfFileName: string;
  protected fieldMappings: FieldMapping[];

  constructor(tableName: string, dbfFileName: string, fieldMappings: FieldMapping[]) {
    this.tableName = tableName;
    this.dbfFileName = dbfFileName;
    this.fieldMappings = fieldMappings;

    this.dbfReader = new DBFReader(MigrationConfig.dbfPath);
    this.validator = new Validator();
    this.transformer = new Transformer();
    this.errorHandler = new ErrorHandler(`${tableName}-${Date.now()}`);
  }

  /**
   * Set progress tracker
   */
  setProgressTracker(tracker: ProgressTracker): void {
    this.progressTracker = tracker;
  }

  /**
   * Set dry run
   */
  setDryRun(dryRun: DryRun): void {
    this.dryRun = dryRun;
  }

  /**
   * Main migration method
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const isDryRun = options.dryRun || false;

    try {
      // Read DBF file
      this.log(`Reading DBF file: ${this.dbfFileName}`);
      const records = await this.dbfReader.readFile(this.dbfFileName);

      this.log(`Found ${records.length} records`);

      // Create progress bar
      if (this.progressTracker) {
        this.progressTracker.createBar(this.tableName, {
          total: records.length,
          label: this.tableName,
        });
      }

      // Process in batches
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < records.length; i += MigrationConfig.batchSize) {
        const batch = records.slice(i, i + MigrationConfig.batchSize);

        const batchResult = await this.processBatch(batch, i, isDryRun, options);

        successCount += batchResult.success;
        errorCount += batchResult.errors;
        skippedCount += batchResult.skipped;

        // Update progress
        if (this.progressTracker) {
          this.progressTracker.update(this.tableName, i + batch.length);
        }

        // Check error threshold
        if (this.errorHandler.isThresholdExceeded()) {
          throw new Error(
            `Error threshold exceeded (${this.errorHandler.getErrorCount()} errors). Aborting migration.`
          );
        }
      }

      // Complete progress bar
      if (this.progressTracker) {
        this.progressTracker.complete(this.tableName);
      }

      // Update error handler stats
      this.errorHandler.updateStats(records.length, successCount);

      // Save error log if there are errors
      if (this.errorHandler.getErrorCount() > 0 || this.errorHandler.getWarningCount() > 0) {
        const errorLogPath = await this.errorHandler.saveErrorLog();
        this.log(`Error log saved: ${errorLogPath}`);
      }

      const elapsedTime = Date.now() - startTime;

      return {
        tableName: this.tableName,
        totalRecords: records.length,
        successCount,
        errorCount,
        skippedCount,
        warningCount: this.errorHandler.getWarningCount(),
        elapsedTime,
        dryRun: isDryRun,
      };
    } catch (error) {
      const elapsedTime = Date.now() - startTime;

      this.logError(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        tableName: this.tableName,
        totalRecords: 0,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        warningCount: 0,
        elapsedTime,
        dryRun: isDryRun,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process a batch of records
   */
  private async processBatch(
    batch: DBFRecord[],
    startIndex: number,
    isDryRun: boolean,
    options: MigrationOptions
  ): Promise<{ success: number; errors: number; skipped: number }> {
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const transformedRecords: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      const recordIndex = startIndex + i;
      const record = batch[i];

      try {
        // Pre-process record (optional hook)
        const preprocessed = await this.preprocessRecord(record, recordIndex);
        if (preprocessed === null) {
          skippedCount++;
          continue;
        }

        // Validate
        const validationResult = this.validator.validate(preprocessed, this.fieldMappings);

        if (!validationResult.valid) {
          for (const error of validationResult.errors) {
            this.errorHandler.logValidationError(
              this.tableName,
              this.dbfFileName,
              recordIndex,
              '',
              error
            );
          }
          errorCount++;

          if (isDryRun && this.dryRun) {
            this.dryRun.addRecord(this.tableName, recordIndex, record, null, validationResult);
          }

          continue;
        }

        // Log warnings
        for (const warning of validationResult.warnings) {
          this.errorHandler.logWarning(this.tableName, this.dbfFileName, recordIndex, warning);
        }

        // Transform
        const transformed = this.transformer.transform(preprocessed, this.fieldMappings);

        // Post-process record (optional hook)
        const postprocessed = await this.postprocessRecord(transformed, recordIndex);

        if (isDryRun && this.dryRun) {
          this.dryRun.addRecord(
            this.tableName,
            recordIndex,
            record,
            postprocessed,
            validationResult
          );
          successCount++;
        } else {
          transformedRecords.push(postprocessed);
          successCount++;
        }
      } catch (error) {
        this.errorHandler.logError(
          this.tableName,
          this.dbfFileName,
          recordIndex,
          `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          {
            severity: 'error',
            stackTrace: error instanceof Error ? error.stack : undefined,
          }
        );
        errorCount++;
      }
    }

    // Insert batch into database (if not dry run)
    if (!isDryRun && transformedRecords.length > 0) {
      try {
        await this.insertBatch(transformedRecords);
      } catch (error) {
        this.errorHandler.logError(
          this.tableName,
          this.dbfFileName,
          startIndex,
          `Batch insert failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          {
            severity: 'fatal',
            stackTrace: error instanceof Error ? error.stack : undefined,
          }
        );
        errorCount += transformedRecords.length;
        successCount -= transformedRecords.length;
      }
    }

    return { success: successCount, errors: errorCount, skipped: skippedCount };
  }

  /**
   * Insert batch into database (must be implemented by subclass)
   */
  protected abstract insertBatch(records: any[]): Promise<void>;

  /**
   * Pre-process record (optional hook for subclasses)
   * Return null to skip the record
   */
  protected async preprocessRecord(record: DBFRecord, recordIndex: number): Promise<DBFRecord | null> {
    return record;
  }

  /**
   * Post-process transformed record (optional hook for subclasses)
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    return record;
  }

  /**
   * Get table mapping (used for relationship lookups)
   */
  protected getTableMapping(): TableMapping {
    return {
      tableName: this.tableName,
      dbfFile: this.dbfFileName,
      fields: this.fieldMappings,
    };
  }

  /**
   * Logging helpers
   */
  protected log(message: string): void {
    if (this.progressTracker) {
      this.progressTracker.logInfo(message);
    } else {
      console.log(message);
    }
  }

  protected logSuccess(message: string): void {
    if (this.progressTracker) {
      this.progressTracker.logSuccess(message);
    } else {
      console.log(`✓ ${message}`);
    }
  }

  protected logError(message: string): void {
    if (this.progressTracker) {
      this.progressTracker.logError(message);
    } else {
      console.error(`✗ ${message}`);
    }
  }

  protected logWarning(message: string): void {
    if (this.progressTracker) {
      this.progressTracker.logWarning(message);
    } else {
      console.warn(`⚠ ${message}`);
    }
  }
}
