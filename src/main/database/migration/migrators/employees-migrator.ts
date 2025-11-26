import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { getDatabase } from '../../index';
import { employees } from '../../schema/employees';
import bcrypt from 'bcrypt';

/**
 * EMPNAME.DBF Migrator
 * Migrates 11 employee records from legacy system
 */
export class EmployeesMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'FIRST',
        target: 'firstName',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toString().trim() : null),
        validate: (val) => !!val && val.length > 0,
      },
      {
        source: 'LAST',
        target: 'lastName',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toString().trim() : null),
        validate: (val) => !!val && val.length > 0,
      },
      {
        source: 'FIRST',
        target: 'username',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toString().trim().toLowerCase() : null),
        validate: (val) => !!val && val.length > 0,
      },
      {
        source: 'TITLE',
        target: 'title',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.toString().trim() : null),
      },
      {
        source: 'START',
        target: 'startDate',
        type: 'date',
        required: false,
        transform: (val) => {
          if (!val) return new Date('2024-01-01').toISOString();
          // Handle DBF date format (YYYYMMDD)
          const dateStr = val.toString();
          if (/^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return new Date(`${year}-${month}-${day}`).toISOString();
          }
          return new Date(val).toISOString();
        },
      },
      {
        source: 'END',
        target: 'endDate',
        type: 'date',
        required: false,
        transform: (val) => {
          if (!val) return null;
          // Handle DBF date format (YYYYMMDD)
          const dateStr = val.toString();
          if (/^\d{8}$/.test(dateStr)) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return new Date(`${year}-${month}-${day}`).toISOString();
          }
          return new Date(val).toISOString();
        },
      },
    ];

    super('employees', 'EMPNAME.DBF', fieldMappings);
  }

  /**
   * Post-process record to add default PIN and role
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    // Hash default PIN '0000'
    const defaultPinHash = await bcrypt.hash('0000', 10);

    return {
      ...record,
      pinHash: defaultPinHash,
      usingDefaultPin: true,
      roleId: null, // Will be assigned after migration based on title
    };
  }

  /**
   * Insert batch of employee records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    const db = getDatabase();
    await db.insert(employees).values(records);
  }
}
