# DBF to SQLite Migration Tool

A comprehensive migration tool for importing legacy DBF (dBASE) database files into the modern SQLite database.

## Overview

This migration system handles the complete process of:
- Analyzing DBF file structures
- Mapping DBF fields to SQLite tables
- Validating and transforming data
- Importing data with progress tracking
- Error logging and reporting
- Dry-run mode for testing

## Directory Structure

```
migration/
├── core/               # Core migration utilities
│   ├── dbf-reader.ts       # DBF file reading
│   ├── validator.ts        # Data validation
│   ├── transformer.ts      # Data transformation
│   ├── error-handler.ts    # Error logging
│   ├── progress-tracker.ts # Progress display
│   └── dry-run.ts          # Dry-run system
├── migrators/          # Table-specific migrators
│   ├── base-migrator.ts    # Base class for all migrators
│   ├── clients-migrator.ts
│   ├── employees-migrator.ts
│   ├── locations-migrator.ts
│   └── parts-migrator.ts
├── analyzers/          # DBF analysis tools
│   ├── structure-analyzer.ts
│   └── mapping-generator.ts
├── types/              # TypeScript type definitions
│   ├── migration.types.ts
│   ├── dbf.types.ts
│   └── error.types.ts
├── config.ts           # Migration configuration
├── index.ts            # Migration orchestrator
├── cli.ts              # Command-line interface
└── README.md           # This file
```

## Installation

Dependencies are already installed via the main package.json:

```json
{
  "dependencies": {
    "node-dbf": "^0.4.0",
    "bcrypt": "^5.1.1",
    "commander": "^12.0.0",
    "cli-progress": "^3.12.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1"
  }
}
```

## Usage

### 1. Analyze DBF Files

Before migration, analyze the DBF file structure:

```bash
npm run migrate:dbf:analyze
```

This will:
- Read all DBF files in `src/main/database/dbf/`
- Generate structure reports in `migration-logs/analysis/`
- Create `dbf-structure-report.json` and `dbf-structure-report.md`
- Propose field mappings in `proposed-mappings.json`

To also generate TypeScript mapping files:

```bash
npm run migrate:dbf:analyze -- --generate-mappings
```

### 2. Dry Run Migration

Test the migration without committing to the database:

```bash
npm run migrate:dbf:dry-run
```

This will:
- Process all records without inserting into database
- Validate all data
- Show preview of transformations
- Generate dry-run reports in `migration-logs/dry-runs/`
- Display summary statistics

### 3. Run Production Migration

Execute the actual migration:

```bash
npm run migrate:dbf
```

This will:
- Create a database backup (in `migration-logs/backups/`)
- Migrate all tables in dependency order
- Show progress bars for each table
- Log errors to `migration-logs/errors/`
- Display final statistics

### 4. Run Specific Migrator

To migrate only a specific table:

```bash
npm run migrate:dbf -- --migrator clients
npm run migrate:dbf -- --migrator employees
npm run migrate:dbf -- --migrator parts
```

### 5. Additional Options

```bash
# Strict mode (fail on any validation error)
npm run migrate:dbf -- --strict

# Skip backup
npm run migrate:dbf -- --no-backup

# Dry run for specific migrator
npm run migrate:dbf:dry-run -- --migrator clients
```

## Configuration

Edit `config.ts` to customize:

```typescript
export const MigrationConfig = {
  // DBF files location
  dbfPath: path.join(__dirname, '../dbf'),

  // Batch processing size
  batchSize: 500,

  // Error handling
  maxErrorsBeforeAbort: 100,
  strictMode: false,

  // Migration execution order (respects dependencies)
  migrationOrder: [
    'roles',
    'permissions',
    'clients',
    'employees',
    'locations',
    'parts',
    // ... more tables
  ],
};
```

## Creating New Migrators

To add a new migrator for a table:

1. Create a new file in `migrators/` directory:

```typescript
// migrators/invoices-migrator.ts
import { BaseMigrator } from './base-migrator';
import { FieldMapping } from '../types/migration.types';
import { db } from '../../index';
import { invoices } from '../../schema/invoices';

export class InvoicesMigrator extends BaseMigrator {
  constructor() {
    const fieldMappings: FieldMapping[] = [
      {
        source: 'INV_ID',
        target: 'id',
        type: 'integer',
        required: true,
        transform: (val) => (val ? parseInt(val) : null),
      },
      // ... more field mappings
    ];

    super('invoices', 'INVOICE.DBF', fieldMappings);
  }

  protected async insertBatch(records: any[]): Promise<void> {
    await db.insert(invoices).values(records);
  }

  // Optional: Pre-process records before validation
  protected async preprocessRecord(record: any, index: number): Promise<any | null> {
    // Return null to skip record
    // Return modified record
    return record;
  }

  // Optional: Post-process after transformation
  protected async postprocessRecord(record: any, index: number): Promise<any> {
    // Perform additional transformations
    return record;
  }
}
```

2. Register the migrator in `index.ts`:

```typescript
import { InvoicesMigrator } from './migrators/invoices-migrator';

this.migrators = new Map([
  // ... existing migrators
  ['invoices', InvoicesMigrator],
]);
```

3. Add to migration order in `config.ts`:

```typescript
migrationOrder: [
  // ... other tables
  'invoices',
],
```

## Field Mapping

Field mappings define how DBF fields are transformed to SQLite columns:

```typescript
{
  source: 'DBF_FIELD',       // Source field name in DBF
  target: 'sqliteColumn',    // Target column in SQLite
  type: 'integer',           // Target data type
  required: true,            // Is field required?
  transform: (val) => {      // Custom transformation function
    return val ? parseInt(val) : null;
  },
  validate: (val) => {       // Custom validation function
    return val > 0;
  }
}
```

### Supported Types

- `integer` - Whole numbers
- `real` - Floating point numbers
- `boolean` - True/false values
- `date` - ISO 8601 date strings
- `string` - Text values

### Built-in Transformations

The Transformer class provides helpers:

```typescript
transformer.transformEmail(value);      // Lowercase, trim
transformer.transformPhone(value);       // Remove formatting
transformer.transformSKU(value);         // Uppercase
transformer.transformMoney(value);       // Round to 2 decimals
transformer.transformId(value);          // Positive integer or null
transformer.transformQuantity(value);    // Non-negative integer
```

## Error Handling

Errors are categorized by severity:

- **warning** - Non-critical issues (logged but migration continues)
- **error** - Validation/transformation failures (record skipped)
- **fatal** - Critical failures (may abort migration)

Error logs are saved to `migration-logs/errors/` with:
- Timestamp
- Table/migrator name
- Record index and ID
- Error message
- Original value
- Stack trace (for fatal errors)

## Progress Tracking

During migration, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DBF to SQLite Migration
  Production Mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/2] Running 4 migrator(s)...

clients              | ████████████████████ | 100% | 1234/1234 | ETA: 0s
employees            | ████████████████████ | 100% | 45/45 | ETA: 0s
locations            | ████████████████████ | 100% | 12/12 | ETA: 0s
parts                | ████████████████████ | 100% | 15425/15425 | ETA: 0s

✓ Migration complete!
```

## Reports

### Analysis Reports

Generated by `npm run migrate:dbf:analyze`:

- `dbf-structure-report.json` - Machine-readable structure
- `dbf-structure-report.md` - Human-readable report
- `proposed-mappings.json` - Suggested field mappings

### Dry Run Reports

Generated by `npm run migrate:dbf:dry-run`:

- `dry-run-{timestamp}.json` - Full validation results
- `dry-run-{timestamp}.md` - Formatted report with samples

### Error Logs

Generated during migration (if errors occur):

- `error-log-{table}-{timestamp}.json` - Complete error details

## Troubleshooting

### "DBF file not found"

Check that DBF files are in `src/main/database/dbf/` directory.

### "Error threshold exceeded"

Too many errors occurred. Check error logs and fix data issues. Adjust `maxErrorsBeforeAbort` in config if needed.

### "Validation failed"

Review the error log to see which records failed validation and why. Common issues:
- Missing required fields
- Invalid data types
- Email/phone format issues

### "Insert failed"

Usually indicates:
- Foreign key constraint violation
- Unique constraint violation
- Invalid data type

Check migration order in config to ensure dependencies are migrated first.

## Development

### Adding Custom Validators

```typescript
// In your migrator
{
  source: 'CUSTOM_FIELD',
  target: 'customField',
  type: 'string',
  required: true,
  validate: (val) => {
    // Custom validation logic
    return val.length >= 5 && val.length <= 50;
  }
}
```

### Adding Custom Transformers

```typescript
{
  source: 'CUSTOM_FIELD',
  target: 'customField',
  type: 'string',
  required: false,
  transform: (val) => {
    // Custom transformation logic
    return val ? val.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
  }
}
```

## Next Steps

1. Run analysis to understand your DBF structure
2. Review generated mappings
3. Adjust field mappings in migrators as needed
4. Run dry-run to test
5. Review dry-run results
6. Run production migration
7. Verify data in database

## Support

For issues or questions, check the main project documentation or create an issue in the repository.
