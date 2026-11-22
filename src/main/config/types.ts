export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
}

/**
 * Whether this machine hosts the shared PostgreSQL + file storage ('host') or
 * connects to a host over the LAN ('client'). Chosen during first-run setup.
 */
export type MachineRole = 'host' | 'client';

/**
 * Local backup configuration. Backups are written to a plain folder on disk —
 * no credentials involved. For an offsite copy, point `backupFolderPath` at a
 * folder already synced by OneDrive/Dropbox/Drive's desktop app.
 */
export interface LocalBackupConfig {
  /** Absolute folder path backup zips are written to. */
  backupFolderPath?: string;
  /** Whether automatic scheduled backups are enabled. */
  autoBackup?: boolean;
  /** Interval between automatic backups, in hours. */
  autoBackupIntervalHours?: number;
  /** Optional directory containing pg_dump / pg_restore executables. */
  pgToolsPath?: string;
  /** ISO timestamp of the last successful backup. */
  lastBackupAt?: string;
}

export interface AppConfig {
  database: DatabaseConfig;
  version: string;
  /** Machine role selected in the first-run wizard. */
  role?: MachineRole;
  /**
   * True once the first-run wizard has completed. Absent on installs that
   * predate the wizard (treated as already set up); explicitly `false` on a
   * fresh default config so the wizard runs.
   */
  setupCompleted?: boolean;
  /** Local backup settings. Backups only ever run on the host machine. */
  backup?: LocalBackupConfig;
}
