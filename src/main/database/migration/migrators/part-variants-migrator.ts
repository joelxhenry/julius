import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { partVariants } from '../../schema/parts';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * INVENTRY.DBF Migrator - Part Variants
 * Migrates 15,425 inventory records to part_variants table
 * Links to parts table using SKU lookup via ForeignKeyLookup
 */
export class PartVariantsMigrator extends BaseMigrator {
  private fkLookup: ForeignKeyLookup;

  constructor(fkLookup: ForeignKeyLookup) {
    super('part_variants', 'INVENTRY.DBF', []);
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
        source: 'LOCATION',
        target: 'location',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val || val.toString().trim().length === 0) return null;
          return val.toString().trim().toUpperCase();
        },
      },
      {
        source: 'MODEL',
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
        source: 'QUANTITY',
        target: 'stockQty',
        type: 'integer',
        required: false,
        transform: (val) => {
          if (!val) return 0;
          const parsed = parseInt(val.toString());
          return isNaN(parsed) ? 0 : parsed;
        },
      },
      {
        source: 'MIN_LEV',
        target: 'reorderLevel',
        type: 'integer',
        required: false,
        transform: (val) => {
          if (!val) return 0;
          const parsed = parseInt(val.toString());
          return isNaN(parsed) ? 0 : parsed;
        },
      },
    ];

    this.fkLookup = fkLookup;
    this.fieldMappings = fieldMappings;
  }

  /**
   * Pre-process to skip deleted records and records without SKU
   */
  protected async preprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Skip deleted records
    if (record['@deleted'] === true) {
      return null;
    }

    const sku = record.SKU ? record.SKU.toString().trim() : null;

    // Skip records with no SKU
    if (!sku || sku.length === 0) {
      this.logWarning(`Skipping variant with empty SKU at index ${recordIndex}`);
      return null;
    }

    return record;
  }

  /**
   * Post-process to lookup part_id and add default values
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    const sku = record.sku;
    const partId = this.fkLookup.getPartId(sku);

    if (!partId) {
      this.logWarning(`Part not found for SKU: ${sku} at record ${recordIndex}`);
      return null; // Skip variant if part doesn't exist
    }

    return {
      partId,
      name: 'Standard',
      description: record.description,
      isGeneric: false,
      price: record.price,
      stockQty: record.stockQty,
      reorderLevel: record.reorderLevel,
      active: true,
      barcode: null,
      location: record.location,
    };
  }

  /**
   * Insert batch of part variant records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(partVariants).values(records);
  }
}
