import { PaymentsMigrator } from './payments-migrator';
import { ForeignKeyLookup } from '../core/foreign-key-lookup';

/**
 * H_INVPAY.DBF Migrator
 * Migrates historical invoice payment records to payments table
 * Uses same structure as current INVPAY.DBF
 */
export class HistoricalPaymentsMigrator extends PaymentsMigrator {
  constructor(fkLookup: ForeignKeyLookup) {
    super(fkLookup, 'H_INVPAY.DBF', true);
  }
}
