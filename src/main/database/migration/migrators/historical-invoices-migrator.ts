import { InvoicesMigrator } from './invoices-migrator';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * H_INVOIC.DBF Migrator
 * Migrates 107,293 historical invoice records to invoices table
 * Uses same structure as current INVOICE.DBF
 */
export class HistoricalInvoicesMigrator extends InvoicesMigrator {
  constructor(fkLookup: ForeignKeyLookup) {
    super(fkLookup, 'H_INVOIC.DBF', true);
  }
}
