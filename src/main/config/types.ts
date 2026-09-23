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
 * Google Drive backup configuration. `clientSecret` and `refreshToken` are
 * encrypted at rest by ConfigManager (same AES scheme as the DB password).
 */
export interface GoogleDriveConfig {
  /** OAuth "Desktop app" client id. */
  clientId?: string;
  /** OAuth client secret (stored encrypted). */
  clientSecret?: string;
  /** Long-lived refresh token from the OAuth loopback flow (stored encrypted). */
  refreshToken?: string;
  /** Drive folder id that holds the uploaded backups. */
  folderId?: string;
  /** Connected Google account email, cached for display. */
  accountEmail?: string;
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
  /** Google Drive backup settings + tokens. */
  googleDrive?: GoogleDriveConfig;
}
