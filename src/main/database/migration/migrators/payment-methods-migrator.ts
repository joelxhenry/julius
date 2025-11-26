import { BaseMigrator } from './base-migrator';
import { FieldMapping, MigrationOptions, MigrationResult } from '../types/migration.types';
import { getDatabase } from '../../index';
import { paymentMethods } from '../../schema/payments';

/**
 * Payment Methods Seeder
 * Seeds payment_methods table with standard payment methods
 * Not a DBF migrator - generates data from predefined list
 */
export class PaymentMethodsMigrator extends BaseMigrator {
  private predefinedMethods = [
    { code: 'cash', name: 'Cash', active: true },
    { code: 'credit-card', name: 'Credit Card', active: true },
    { code: 'debit-card', name: 'Debit Card', active: true },
    { code: 'check', name: 'Check', active: true },
    { code: 'bank-transfer', name: 'Bank Transfer', active: true },
    { code: 'credit-note', name: 'Credit Note', active: true },
    { code: 'other', name: 'Other', active: true },
  ];

  constructor() {
    // No DBF file, no field mappings - this is a seeder
    super('payment_methods', '', []);
  }

  /**
   * Override migrate to seed predefined payment methods
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const isDryRun = options.dryRun || false;

    try {
      this.log(`Seeding ${this.predefinedMethods.length} payment methods...`);

      if (!isDryRun) {
        const db = getDatabase();
        
        // Insert all payment methods
        await db.insert(paymentMethods).values(this.predefinedMethods);
        
        this.log(`✓ Successfully seeded ${this.predefinedMethods.length} payment methods`);
      } else {
        this.log(`[DRY RUN] Would seed ${this.predefinedMethods.length} payment methods`);
        
        // Record in dry run
        if (this.dryRun) {
          for (const method of this.predefinedMethods) {
            this.dryRun.recordSuccess('payment_methods', method, method);
          }
        }
      }

      const elapsedTime = Date.now() - startTime;

      return {
        tableName: 'payment_methods',
        totalRecords: this.predefinedMethods.length,
        successCount: this.predefinedMethods.length,
        errorCount: 0,
        skippedCount: 0,
        warningCount: 0,
        elapsedTime,
        dryRun: isDryRun,
      };
    } catch (error) {
      this.logError(`Failed to seed payment methods: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        tableName: 'payment_methods',
        totalRecords: this.predefinedMethods.length,
        successCount: 0,
        errorCount: 1,
        skippedCount: 0,
        warningCount: 0,
        elapsedTime: Date.now() - startTime,
        dryRun: isDryRun,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
