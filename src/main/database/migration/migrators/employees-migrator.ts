import * as bcrypt from 'bcrypt';
import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { DBFRecord } from '../types/dbf.types';
import { db } from '../../index';
import { employees } from '../../schema/employees';

export class EmployeesMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'EMP_ID',
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
        source: 'USERNAME',
        target: 'username',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toLowerCase().trim() : null),
      },
      {
        source: 'PIN',
        target: 'pinHash',
        type: 'string',
        required: true,
        // Note: PIN will be hashed in postprocessRecord
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'ROLE_ID',
        target: 'roleId',
        type: 'integer',
        required: false,
        transform: (val) => (val ? parseInt(val) : null),
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

    super('employees', 'EMPNAME.DBF', fieldMappings);
  }

  /**
   * Post-process: Hash the PIN
   */
  protected async postprocessRecord(record: any, recordIndex: number): Promise<any> {
    if (record.pinHash) {
      try {
        // Hash the PIN with bcrypt (salt rounds: 10)
        record.pinHash = await bcrypt.hash(record.pinHash, 10);
      } catch (error) {
        this.logError(
          `Failed to hash PIN for record ${recordIndex}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        throw error;
      }
    }

    return record;
  }

  /**
   * Insert batch of employee records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    await db.insert(employees).values(records);
  }
}
