import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { invoices } from '../../schema/invoices';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * INVOICE.DBF Migrator
 * Migrates 43,523 invoice records to invoices table
 * Requires clients and employees to be migrated first for FK lookups
 */
export class InvoicesMigrator extends BaseMigrator {
  private fkLookup: ForeignKeyLookup;
  protected isHistorical: boolean;

  constructor(fkLookup: ForeignKeyLookup, dbfFileName: string = 'INVOICE.DBF', isHistorical: boolean = false) {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'INV_NUMBER',
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
        source: 'CL_NAME',
        target: 'clientId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'SALESPERSN',
        target: 'employeeId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'STATUS',
        target: 'status',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val) return 'completed';
          const status = val.toString().toUpperCase().trim();
          if (status === 'A') return 'active';
          if (status === 'C') return 'completed';
          return 'completed';
        },
      },
      {
        source: 'SUB_TOTAL',
        target: 'subtotal',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'TAX',
        target: 'taxTotal',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'TOTAL',
        target: 'total',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'TOTAL_PAID',
        target: 'amountPaid',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'INV_DATE',
        target: 'createdAt',
        type: 'date',
        required: false,
        transform: (val) => {
          if (!val) return new Date().toISOString();
          
          // Parse YYYYMMDD format
          const dateStr = val.toString().trim();
          if (dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}T00:00:00.000Z`;
          }
          
          return new Date().toISOString();
        },
      },
    ];

    super('invoices', dbfFileName, fieldMappings);
    this.fkLookup = fkLookup;
    this.isHistorical = isHistorical;
  }

  /**
   * Pre-process to skip deleted records
   */
  protected async preprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Skip deleted records
    if (record['@deleted'] === true) {
      return null;
    }

    return record;
  }

  /**
   * Post-process to lookup foreign keys and calculate balance
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Lookup client ID
    const clientId = this.fkLookup.getClientId(record.clientId);
    if (!clientId && record.clientId) {
      this.logWarning(`Client not found: ${record.clientId} at record ${recordIndex}`);
    }

    // Lookup employee ID by code/username
    const employeeId = this.fkLookup.getEmployeeIdByCode(record.employeeId);
    if (!employeeId && record.employeeId) {
      this.logWarning(`Employee not found: ${record.employeeId} at record ${recordIndex}`);
    }

    // Calculate balance
    const balance = record.total - record.amountPaid;

    return {
      legacyId: record.legacyId,
      clientId: clientId || null,
      employeeId: employeeId || null,
      status: record.status,
      subtotal: record.subtotal,
      taxTotal: record.taxTotal,
      discountTotal: 0.0, // Not tracked in legacy
      total: record.total,
      amountPaid: record.amountPaid,
      balance: balance,
      isHistorical: this.isHistorical ? 1 : 0,
      createdAt: record.createdAt,
    };
  }

  /**
   * Insert batch of invoice records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(invoices).values(records);
  }
}
