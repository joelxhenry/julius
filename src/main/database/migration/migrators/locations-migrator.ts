import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { db } from '../../index';
import { locations } from '../../schema/locations';

export class LocationsMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'LOC_ID',
        target: 'id',
        type: 'integer',
        required: true,
        transform: (val) => (val ? parseInt(val) : null),
      },
      {
        source: 'CODE',
        target: 'code',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.toUpperCase().trim() : null),
      },
      {
        source: 'NAME',
        target: 'name',
        type: 'string',
        required: true,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'DESCRIP',
        target: 'description',
        type: 'string',
        required: false,
        transform: (val) => (val ? val.trim() : null),
      },
      {
        source: 'ACTIVE',
        target: 'active',
        type: 'boolean',
        required: false,
        transform: (val) =>
          val === 'T' || val === 'Y' || val === '1' || val === 1 || val === true,
      },
    ];

    super('locations', 'INV_STOR.DBF', fieldMappings);
  }

  /**
   * Insert batch of location records
   */
  protected async insertBatch(records: any[]): Promise<void> {
    await db.insert(locations).values(records);
  }
}
