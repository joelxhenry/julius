import { InvoiceItemsMigrator } from './invoice-items-migrator';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * H_INVDET.DBF Migrator
 * Migrates 155,239 historical invoice line item records to invoice_items table
 * Uses same structure as current INVDETAI.DBF
 */
export class HistoricalInvoiceItemsMigrator extends InvoiceItemsMigrator {
  constructor(fkLookup: ForeignKeyLookup) {
    super(fkLookup, 'H_INVDET.DBF');
  }
}
