import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { db } from '../../index';
import { clients } from '../../schema/clients';

export class ClientsMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'CLIENT_ID',
        target: 'id',
        type: 'integer',
        required: true,
        transform: (val) => (val ? parseInt(val) : null),
      },
      {
        source: 'NAME',
        target: 'name',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'EMAIL',
        target: 'email',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toLowerCase().trim() : null),
        validate: (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      },
      {
        source: 'PHONE',
        target: 'phone',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'ADDRESS',
        target: 'address',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'CITY',
        target: 'city',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'PROVINCE',
        target: 'province',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'POSTAL',
        target: 'postalCode',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'TAX_NO',
        target: 'taxNumber',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'CREDIT_LIM',
        target: 'creditLimit',
        type: 'real',
        required: false,
        transform: (val) => (val ? parseFloat(val) : 0.0),
      },
      {
        source: 'BALANCE',
        target: 'balance',
        type: 'real',
        required: false,
        transform: (val) => (val ? parseFloat(val) : 0.0),
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
      {
        source: 'CREATED_DT',
        target: 'createdAt',
        type: 'date',
        required: false,
        transform: (val) => {
          if (!val) return new Date().toISOString();
          // Handle DBF date format (YYYYMMDD)
          if (typeof val === 'string' && /^\d{8}$/.test(val)) {
            const year = val.substring(0, 4);
            const month = val.substring(4, 6);
            const day = val.substring(6, 8);
            return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString();
          }
          return new Date(val).toISOString();
        },
      },
    ];

    super('clients', 'CLIENT.DBF', fieldMappings);
  }

  /**
   * Insert batch of client records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    await db.insert(clients).values(records);
  }
}
