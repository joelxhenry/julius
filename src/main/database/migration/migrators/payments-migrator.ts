import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { payments, paymentMethods } from '../../schema/payments';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * INVPAY.DBF Migrator
 * Migrates 50,363 invoice payment records to payments table
 * Requires invoices and payment_methods to be migrated first for FK lookups
 */
export class PaymentsMigrator extends BaseMigrator {
  private fkLookup: ForeignKeyLookup;
  private paymentMethodCache: Map<string, number> = new Map();
  protected isHistorical: boolean;

  constructor(fkLookup: ForeignKeyLookup, dbfFileName: string = 'INVPAY.DBF', isHistorical: boolean = false) {
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
        source: 'INV_NUMBER',
        target: 'invoiceId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'PAY_DESC',
        target: 'paymentMethodId',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'AMOUNT',
        target: 'amount',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'PAY_DATE',
        target: 'paidAt',
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

    super('payments', dbfFileName, fieldMappings);
    this.fkLookup = fkLookup;
    this.isHistorical = isHistorical;
  }

  /**
   * Override migrate to load payment methods first
   */
  async migrate(options: any = {}): Promise<any> {
    await this.loadPaymentMethods();
    return super.migrate(options);
  }

  /**
   * Load payment methods into cache for FK lookups
   */
  private async loadPaymentMethods(): Promise<void> {
    if (this.isDryRunMode()) {
      // In dry-run mode, create mock payment methods
      this.paymentMethodCache.set('CASH', 1);
      this.paymentMethodCache.set('CREDIT CARD', 2);
      this.paymentMethodCache.set('CHECK', 3);
      this.paymentMethodCache.set('BANK TRANSFER', 4);
      this.paymentMethodCache.set('OTHER', 5);
      this.log('Using mock payment methods (dry-run mode)');
    } else {
      const db = getDatabase();
      const methods = await db.select().from(paymentMethods);
      
      for (const method of methods) {
        // Store by both code and name for flexible lookup
        this.paymentMethodCache.set(method.code.toUpperCase(), method.id);
        this.paymentMethodCache.set(method.name.toUpperCase(), method.id);
      }
      
      this.log(`Loaded ${methods.length} payment methods into cache`);
    }
  }

  /**
   * Map payment description to payment method ID
   */
  private getPaymentMethodId(paymentDesc: string | null): number | null {
    if (!paymentDesc) return null;

    const desc = paymentDesc.toString().trim().toUpperCase();
    
    // Try exact match first
    if (this.paymentMethodCache.has(desc)) {
      return this.paymentMethodCache.get(desc)!;
    }

    // Try partial matches for common variations
    if (desc.includes('CASH')) {
      return this.paymentMethodCache.get('CASH') || null;
    }
    if (desc.includes('CREDIT') || desc.includes('CARD')) {
      return this.paymentMethodCache.get('CREDIT CARD') || null;
    }
    if (desc.includes('CHECK') || desc.includes('CHEQUE')) {
      return this.paymentMethodCache.get('CHECK') || null;
    }
    if (desc.includes('BANK') || desc.includes('TRANSFER')) {
      return this.paymentMethodCache.get('BANK TRANSFER') || null;
    }

    // Default to OTHER or first available method
    return this.paymentMethodCache.get('OTHER') || 
           Array.from(this.paymentMethodCache.values())[0] || 
           null;
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
      this.logWarning(`Skipping payment without invoice number at index ${recordIndex}`);
      return null;
    }

    // Skip records with zero or negative amount
    const amount = parseFloat(record.AMOUNT || 0);
    if (amount <= 0) {
      this.logWarning(`Skipping payment with invalid amount (${amount}) at index ${recordIndex}`);
      return null;
    }

    return record;
  }

  /**
   * Post-process to lookup foreign keys
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Lookup invoice ID by legacy invoice number
    let invoiceId: number | null = null;

    // In dry-run mode, generate mock invoice IDs
    if (this.isDryRunMode()) {
      invoiceId = parseInt(record.invoiceId) || 1;
    } else {
      // In production mode, lookup actual invoice from database
      try {
        const db = getDatabase();
        const { invoices: invoicesTable } = await import('../../schema/invoices');
        const { eq, and } = await import('drizzle-orm');
        
        const invoice = await db
          .select({ id: invoicesTable.id })
          .from(invoicesTable)
          .where(
            and(
              eq(invoicesTable.legacyId, parseInt(record.invoiceId)),
              eq(invoicesTable.isHistorical, this.isHistorical ? 1 : 0)
            )
          )
          .limit(1);

        invoiceId = invoice[0]?.id || null;

        if (!invoiceId && record.invoiceId) {
          this.logWarning(`Invoice not found for INV_NUMBER: ${record.invoiceId} at record ${recordIndex}`);
          return null; // Skip payments without valid invoice
        }
      } catch (error) {
        this.logError(`Error looking up invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    }

    // Lookup payment method ID
    const paymentMethodId = this.getPaymentMethodId(record.paymentMethodId);
    if (!paymentMethodId && record.paymentMethodId) {
      this.logWarning(`Payment method not found for: ${record.paymentMethodId} at record ${recordIndex} - using default`);
    }

    return {
      legacyId: record.legacyId,
      invoiceId: invoiceId,
      employeeId: null, // Not tracked in legacy system
      paymentMethodId: paymentMethodId || 1, // Default to first payment method
      amount: record.amount,
      paidAt: record.paidAt,
    };
  }

  /**
   * Insert batch of payment records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(payments).values(records);
  }
}
