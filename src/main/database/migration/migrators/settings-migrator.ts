import { BaseMigrator } from './base-migrator';
import { MigrationOptions, MigrationResult } from '../types/migration.types';
import { getDatabase } from '../../index';
import { systemSettings } from '../../schema/settings';

/**
 * System Settings Seeder
 * Seeds system_settings table with default application settings
 * Not a DBF migrator - generates data from predefined list
 */
export class SettingsMigrator extends BaseMigrator {
  private predefinedSettings = [
    {
      key: 'business_name',
      value: 'Auto Parts Store',
      group: 'business',
      description: 'Business name displayed on invoices and reports',
      readonly: false,
      visible: true,
    },
    {
      key: 'business_address',
      value: '',
      group: 'business',
      description: 'Business physical address',
      readonly: false,
      visible: true,
    },
    {
      key: 'business_phone',
      value: '',
      group: 'business',
      description: 'Business contact phone number',
      readonly: false,
      visible: true,
    },
    {
      key: 'business_email',
      value: '',
      group: 'business',
      description: 'Business contact email address',
      readonly: false,
      visible: true,
    },
    {
      key: 'tax_rate',
      value: '0.15',
      group: 'sales',
      description: 'Default tax rate as decimal (e.g., 0.15 for 15%)',
      readonly: false,
      visible: true,
    },
    {
      key: 'currency_symbol',
      value: '$',
      group: 'sales',
      description: 'Currency symbol for display',
      readonly: false,
      visible: true,
    },
    {
      key: 'currency_code',
      value: 'JMD',
      group: 'sales',
      description: 'Currency code (ISO 4217)',
      readonly: false,
      visible: true,
    },
    {
      key: 'invoice_prefix',
      value: 'INV',
      group: 'sales',
      description: 'Prefix for invoice numbers',
      readonly: false,
      visible: true,
    },
    {
      key: 'quote_prefix',
      value: 'QTE',
      group: 'sales',
      description: 'Prefix for quotation numbers',
      readonly: false,
      visible: true,
    },
    {
      key: 'credit_note_prefix',
      value: 'CN',
      group: 'sales',
      description: 'Prefix for credit note numbers',
      readonly: false,
      visible: true,
    },
    {
      key: 'low_stock_threshold',
      value: '5',
      group: 'inventory',
      description: 'Default low stock warning threshold',
      readonly: false,
      visible: true,
    },
    {
      key: 'enable_barcode_scanning',
      value: 'true',
      group: 'inventory',
      description: 'Enable barcode scanning functionality',
      readonly: false,
      visible: true,
    },
    {
      key: 'receipt_footer',
      value: 'Thank you for your business!',
      group: 'printing',
      description: 'Footer text on printed receipts',
      readonly: false,
      visible: true,
    },
    {
      key: 'print_auto',
      value: 'false',
      group: 'printing',
      description: 'Automatically print invoices after creation',
      readonly: false,
      visible: true,
    },
    {
      key: 'default_payment_method',
      value: 'cash',
      group: 'sales',
      description: 'Default payment method code',
      readonly: false,
      visible: true,
    },
    {
      key: 'allow_negative_stock',
      value: 'false',
      group: 'inventory',
      description: 'Allow selling items with negative stock',
      readonly: false,
      visible: true,
    },
    {
      key: 'session_timeout',
      value: '30',
      group: 'system',
      description: 'Session timeout in minutes',
      readonly: false,
      visible: true,
    },
    {
      key: 'backup_enabled',
      value: 'true',
      group: 'system',
      description: 'Enable automatic database backups',
      readonly: false,
      visible: true,
    },
    {
      key: 'backup_frequency',
      value: 'daily',
      group: 'system',
      description: 'Backup frequency: daily, weekly, monthly',
      readonly: false,
      visible: true,
    },
  ];

  constructor() {
    // No DBF file, no field mappings - this is a seeder
    super('system_settings', '', []);
  }

  /**
   * Override migrate to seed predefined settings
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const isDryRun = options.dryRun || false;

    try {
      this.log(`Seeding ${this.predefinedSettings.length} system settings...`);

      if (!isDryRun) {
        const db = getDatabase();
        
        // Insert all settings
        await db.insert(systemSettings).values(this.predefinedSettings);
        
        this.log(`✓ Successfully seeded ${this.predefinedSettings.length} system settings`);
      } else {
        this.log(`[DRY RUN] Would seed ${this.predefinedSettings.length} system settings`);
        
        // Record in dry run
        if (this.dryRun) {
          for (const setting of this.predefinedSettings) {
            this.dryRun.recordSuccess('system_settings', setting, setting);
          }
        }
      }

      const elapsedTime = Date.now() - startTime;

      return {
        tableName: 'system_settings',
        totalRecords: this.predefinedSettings.length,
        successCount: this.predefinedSettings.length,
        errorCount: 0,
        skippedCount: 0,
        warningCount: 0,
        elapsedTime,
        dryRun: isDryRun,
      };
    } catch (error) {
      this.logError(`Failed to seed system settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        tableName: 'system_settings',
        totalRecords: this.predefinedSettings.length,
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
