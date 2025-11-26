import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { parts } from '../../schema/parts';

/**
 * INVENTRY.DBF Migrator - Parts only
 * Migrates 15,425 inventory records to parts table
 * Part variants are migrated separately by PartVariantsMigrator
 */
export class PartsMigrator extends BaseMigrator {
  private skuCache: Set<string> = new Set();

  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'SKU',
        target: 'sku',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toString().trim() : null),
        validate: (val) => !!val && val.length > 0,
      },
      {
        source: 'DESCR1',
        target: 'name',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val || val.toString().trim().length === 0) {
            return '[NO DESCRIPTION - NEEDS REVIEW]';
          }
          return val.toString().trim();
        },
      },
      {
        source: 'CATEGORY',
        target: 'category',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'DESCR2',
        target: 'description',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'PRICE',
        target: 'price',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'TAXCODE',
        target: 'taxable',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val) return true;
          const str = val.toString().toUpperCase();
          return str === 'Y' || str === 'YES' || str === 'T' || str === 'TRUE';
        },
      },
    ];

    super('parts', 'INVENTRY.DBF', fieldMappings);
  }

  /**
   * Pre-process to check for duplicate SKUs and skip deleted/invalid records
   */
  protected async preprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Skip deleted records
    if (record['@deleted'] === true) {
      return null;
    }

    const sku = record.SKU ? record.SKU.toString().trim() : null;

    // Skip records with no SKU
    if (!sku || sku.length === 0) {
      this.logWarning(`Skipping record with empty SKU at index ${recordIndex}`);
      return null;
    }

    // Skip if we've already seen this SKU
    if (this.skuCache.has(sku)) {
      this.logWarning(`Skipping duplicate SKU: ${sku} at record ${recordIndex}`);
      return null;
    }

    this.skuCache.add(sku);

    return record;
  }

  /**
   * Insert batch of parts records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(parts).values(records);
  }
}
