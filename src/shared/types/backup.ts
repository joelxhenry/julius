/**
 * Google Drive backup/restore IPC contract. Like the setup and update channels,
 * these are kept OUT of the `IpcChannel` enum so the data-handler cleanup that
 * runs on every database reconnect never strips them. Restore must remain
 * callable while the database is being torn down and re-initialised.
 */
export const BackupIpc = {
  /** invoke: current Drive connection + settings status. */
  GET_STATUS: 'backup:get-status',
  /** invoke: persist backup settings (client id/secret, schedule, pg tools path). */
  SAVE_SETTINGS: 'backup:save-settings',
  /** invoke: run the OAuth loopback flow and store a refresh token. */
  CONNECT: 'backup:connect',
  /** invoke: clear stored Google Drive tokens. */
  DISCONNECT: 'backup:disconnect',
  /** invoke: create a backup and upload it to Drive. */
  BACKUP_NOW: 'backup:backup-now',
  /** invoke: list backups currently stored in Drive. */
  LIST: 'backup:list',
  /** invoke: download + restore a backup by Drive file id (destructive). */
  RESTORE: 'backup:restore',
  /** invoke: delete a backup from Drive by file id. */
  DELETE: 'backup:delete',
  /** invoke: download a backup to a local file chosen via save dialog. */
  DOWNLOAD: 'backup:download',
  /** event (main -> renderer): long-running backup/restore progress. */
  PROGRESS: 'backup:progress',
} as const;

/** Settings the user controls for the backup feature. */
export interface BackupSettings {
  /** Google OAuth "Desktop app" client id. */
  clientId: string;
  /** Google OAuth client secret. Write-only from the renderer's perspective. */
  clientSecret: string;
  /** Whether automatic scheduled backups are enabled. */
  autoBackup: boolean;
  /** Interval between automatic backups, in hours. */
  autoBackupIntervalHours: number;
  /** Optional directory containing pg_dump / pg_restore executables. */
  pgToolsPath: string;
}

/** Snapshot of the current backup configuration + Drive connection. */
export interface BackupStatus {
  /** True once a client id/secret have been saved. */
  configured: boolean;
  /** True once a refresh token is stored (OAuth completed). */
  connected: boolean;
  /** The connected Google account email, if known. */
  accountEmail: string | null;
  /** Whether automatic backups are enabled. */
  autoBackup: boolean;
  /** Interval between automatic backups, in hours. */
  autoBackupIntervalHours: number;
  /** Optional directory containing the Postgres client tools. */
  pgToolsPath: string;
  /** ISO timestamp of the last successful backup, if any. */
  lastBackupAt: string | null;
  /** Whether the client id/secret are present so a connect can be attempted. */
  hasClientId: boolean;
  hasClientSecret: boolean;
}

/** A backup file as listed from Drive. */
export interface BackupFile {
  id: string;
  name: string;
  /** ISO created time. */
  createdAt: string;
  /** Size in bytes, if reported by Drive. */
  size: number | null;
}

/** Phases surfaced to the UI during a backup or restore. */
export type BackupPhase =
  | 'dumping-database'
  | 'archiving-images'
  | 'uploading'
  | 'downloading'
  | 'extracting'
  | 'restoring-database'
  | 'restoring-images'
  | 'reconnecting'
  | 'pruning'
  | 'done'
  | 'error';

/** Progress event streamed to the renderer over BackupIpc.PROGRESS. */
export interface BackupProgress {
  /** Which operation this event belongs to. */
  operation: 'backup' | 'restore';
  phase: BackupPhase;
  /** Human-readable status message. */
  message: string;
  /** 0-100 when a meaningful percentage is available, else null (indeterminate). */
  percent: number | null;
}
