import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { clients } from '../../schema/clients';

/**
 * CLIENT.DBF Migrator
 * Migrates 809 client records from legacy system
 */
export class ClientsMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'CL_NUMBER',
        target: 'legacyId',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val) return null;
          const trimmed = val.toString().trim();
          const parsed = parseInt(trimmed);
          return isNaN(parsed) ? null : parsed;
        },
      },
      {
        source: 'CLIENT',
        target: 'name',
        type: 'string',
        required: false,
        transform: (val) => {
          if (!val || val.toString().trim().length === 0) {
            return '[INVALID CLIENT NAME - NEEDS REVIEW]';
          }
          return val.toString().trim();
        },
      },
      {
        source: 'CL_PHONE',
        target: 'phone',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'CL_ADDR1',
        target: 'address1',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'CL_ADDR2',
        target: 'address2',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'CRED_LIMIT',
        target: 'creditLimit',
        type: 'real',
        required: false,
        transform: (val) => {
          if (!val || val === '' || val === null || val === undefined) return 0.0;
          const parsed = parseFloat(val.toString().replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
      {
        source: 'CL_DISC',
        target: 'discountRate',
        type: 'real',
        required: true,
        transform: (val) => {
          if (!val) return 0.0;
          const parsed = parseFloat(val.toString());
          return isNaN(parsed) ? 0.0 : parsed;
        },
      },
    ];

    super('clients', 'CLIENT.DBF', fieldMappings);
  }

  /**
   * Insert batch of client records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(clients).values(records);
  }
}
