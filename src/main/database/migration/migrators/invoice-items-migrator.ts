import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { invoiceItems } from '../../schema/invoices';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * INVDETAI.DBF Migrator
 * Migrates 83,249 invoice line item records to invoice_items table
 * Requires invoices and parts to be migrated first for FK lookups
 */
export class InvoiceItemsMigrator extends BaseMigrator {
  private fkLookup: ForeignKeyLookup;

  constructor(fkLookup: ForeignKeyLookup, dbfFileName: string = 'INVDETAI.DBF') {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'LIN_NUMBER',
        target: 'legacyId',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val || val.toString().trim().length === 0) return null;
          const parsed = parseInt(val.toString().trim());
          return isNaN(parsed) ? null : parsed;
        },
      },
      {
        source: 'INV_NUMBER',
        target: 'invoiceId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'SKU',
        target: 'variantId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'QUANTITY',
        target: 'quantity',
        type: 'integer',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 1;
          const parsed = parseInt(val.toString());
          return isNaN(parsed) ? 1 : parsed;
        },
      },
      {
        source: 'UNIT',
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
        source: 'DISC',
        target: 'discount',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          // Discount may be negative in legacy, convert to positive
          return isNaN(parsed) ? 0.0 : Math.abs(parsed);
        },
      },
      {
        source: 'AMOUNT',
        target: 'tax',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
    ];

    super('invoice_items', dbfFileName, fieldMappings);
    this.fkLookup = fkLookup;
  }

  /**
   * Pre-process to skip deleted records
   */
  protected async preprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Skip deleted records
    if (record['@deleted'] === true) {
      return null;
    }

    // Skip records without invoice number
    if (!record.INV_NUMBER || record.INV_NUMBER.toString().trim().length === 0) {
      this.logWarning(`Skipping record without invoice number at index ${recordIndex}`);
      return null;
    }

    return record;
  }

  /**
   * Post-process to lookup foreign keys and calculate tax
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Lookup invoice ID by legacy invoice number
    let invoiceId: number | null = null;

    // In dry-run mode, generate mock invoice IDs to validate the migration logic
    if (this.isDryRunMode()) {
      invoiceId = parseInt(record.invoiceId) || 1;
    } else {
      // In production mode, lookup actual invoice from database
      try {
        const db = getDatabase();
        const invoice = await db.query.invoices.findFirst({
          where: (invoices, { eq }) => eq(invoices.legacyId, parseInt(record.invoiceId)),
          columns: { id: true },
        });

        invoiceId = invoice?.id || null;

        if (!invoiceId && record.invoiceId) {
          this.logWarning(`Invoice not found for INV_NUMBER: ${record.invoiceId} at record ${recordIndex}`);
          return null; // Skip items without valid invoice
        }
      } catch (error) {
        this.logError(`Error looking up invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    }

    // Lookup variant ID by SKU
    // If variant is not found, save as null instead of skipping the record
    const variantId = this.fkLookup.getPartVariantId(record.variantId);
    if (!variantId && record.variantId) {
      this.logWarning(`Part variant not found for SKU: ${record.variantId} at record ${recordIndex} - saving with null variant_id`);
    }

    // Calculate tax from AMOUNT field
    // Tax calculation: AMOUNT already contains the tax amount in legacy system
    const tax = record.tax || 0.0;

    return {
      legacyId: record.legacyId,
      invoiceId: invoiceId,
      variantId: variantId || null,
      quantity: record.quantity,
      price: record.price,
      discount: record.discount,
      tax: tax,
    };
  }

  /**
   * Insert batch of invoice item records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(invoiceItems).values(records);
  }
}
