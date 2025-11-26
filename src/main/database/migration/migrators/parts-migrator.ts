import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { db } from '../../index';
import { parts, partVariants } from '../../schema/parts';

export class PartsMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'PART_ID',
        target: 'id',
        type: 'integer',
        required: true,
        transform: (val) => (val ? parseInt(val) : null),
      },
      {
        source: 'SKU',
        target: 'sku',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toUpperCase().trim() : null),
      },
      {
        source: 'DESCRIP',
        target: 'description',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'CATEGORY',
        target: 'category',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'MANUFACT',
        target: 'manufacturer',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'OEM_NO',
        target: 'oemNumber',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'UNIT',
        target: 'unit',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : 'EA'),
      },
      {
        source: 'MIN_QTY',
        target: 'minStockQty',
        type: 'integer',
        required: false,
        transform: (val) => {
          const num = val ? parseInt(val) : 0;
          return num < 0 ? 0 : num;
        },
      },
      {
        source: 'REORDER_QT',
        target: 'reorderQty',
        type: 'integer',
        required: false,
        transform: (val) => {
          const num = val ? parseInt(val) : 0;
          return num < 0 ? 0 : num;
        },
      },
      {
        source: 'ACTIVE',
        target: 'active',
        type: 'boolean',
        required: false,
        transform: (val) =>
          val === 'T' || val === 'Y' || val === '1' || val === 1 || val === true,
      },
      {
        source: 'NOTES',
        target: 'notes',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      // Variant fields (will be extracted to partVariants table)
      {
        source: 'PRICE',
        target: 'price',
        type: 'real',
        required: false,
        transform: (val) => {
          const num = val ? parseFloat(val) : 0.0;
          return num < 0 ? 0.0 : num;
        },
      },
      {
        source: 'COST',
        target: 'cost',
        type: 'real',
        required: false,
        transform: (val) => {
          const num = val ? parseFloat(val) : 0.0;
          return num < 0 ? 0.0 : num;
        },
      },
      {
        source: 'STOCK_QTY',
        target: 'stockQty',
        type: 'integer',
        required: false,
        transform: (val) => {
          const num = val ? parseInt(val) : 0;
          return num < 0 ? 0 : num;
        },
      },
      {
        source: 'BARCODE',
        target: 'barcode',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
    ];

    super('parts', 'INVENTRY.DBF', fieldMappings);
  }

  /**
   * Insert batch: Create both parts and part_variants
   */
  protected async insertBatch(records: any[]): Promise<void> {
    // Split records into parts and variants
    const partsRecords = records.map((r) => ({
      id: r.id,
      sku: r.sku,
      description: r.description,
      category: r.category,
      manufacturer: r.manufacturer,
      oemNumber: r.oemNumber,
      unit: r.unit,
      minStockQty: r.minStockQty,
      reorderQty: r.reorderQty,
      active: r.active,
      notes: r.notes,
    }));

    const variantsRecords = records.map((r) => ({
      partId: r.id,
      price: r.price,
      cost: r.cost,
      stockQty: r.stockQty,
      barcode: r.barcode,
    }));

    // Insert parts first
    await db.insert(parts).values(partsRecords);

    // Then insert variants
    await db.insert(partVariants).values(variantsRecords);

    this.logSuccess(`Inserted ${partsRecords.length} parts with variants`);
  }
}
