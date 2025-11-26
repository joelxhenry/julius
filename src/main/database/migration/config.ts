import path from 'path';

export const MigrationConfig = {
  // DBF files location
  dbfPath: path.join(__dirname, '../dbf'),

  // Migration logs output
  logsPath: path.join(process.cwd(), 'migration-logs'),
  analysisPath: path.join(process.cwd(), 'migration-logs/analysis'),
  dryRunPath: path.join(process.cwd(), 'migration-logs/dry-runs'),
  errorsPath: path.join(process.cwd(), 'migration-logs/errors'),

  // Batch processing
  batchSize: 500,

  // Error handling
  maxErrorsBeforeAbort: 100,
  strictMode: false,

  // Progress reporting
  progressUpdateInterval: 100, // Update progress every N records

  // Database
  dbPath: path.join(process.cwd(), 'dev.db'),

  // Migration execution order (defines dependencies)
  migrationOrder: [
    'roles',
    'permissions',
    'rolePermissions',
    'paymentMethods',
    'clients',
    'employees',
    'locations',
    'vehicleModels',
    'parts', // parts before partVariants
    'partVariants',
    'partLocations',
    'partModels',
    'quotations',
    'quotationItems',
    'invoices',
    'invoiceItems',
    'payments',
    'creditNotes',
    'creditNoteAllocations',
    'auditLogs',
  ],
};
