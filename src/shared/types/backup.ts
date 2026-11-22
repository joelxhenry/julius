/**
 * Local backup/restore IPC contract. Like the setup and update channels,
 * these are kept OUT of the `IpcChannel` enum so the data-handler cleanup that
 * runs on every database reconnect never strips them. Restore must remain
 * callable while the database is being torn down and re-initialised.
 *
 * Backups only ever run on the host machine (where the database and image
 * store physically live) — every mutating handler rejects on a client.
 */
export const BackupIpc = {
  /** invoke: current backup folder + settings status. */
  GET_STATUS: 'backup:get-status',
  /** invoke: persist backup settings (schedule, pg tools path). */
  SAVE_SETTINGS: 'backup:save-settings',
  /** invoke: pick a backup folder via a native directory dialog. */
  CHOOSE_FOLDER: 'backup:choose-folder',
  /** invoke: reveal the configured backup folder in the OS file explorer. */
  OPEN_FOLDER: 'backup:open-folder',
  /** invoke: create a backup and write it to the configured folder. */
  BACKUP_NOW: 'backup:backup-now',
  /** invoke: list backups currently in the configured folder. */
  LIST: 'backup:list',
  /** invoke: restore a backup from the configured folder by file name (destructive). */
  RESTORE: 'backup:restore',
  /** invoke: restore from any local backup .zip chosen via open dialog (destructive). */
  RESTORE_FROM_FILE: 'backup:restore-from-file',
  /** invoke: delete a backup from the configured folder by file name. */
  DELETE: 'backup:delete',
  /** event (main -> renderer): long-running backup/restore progress. */
  PROGRESS: 'backup:progress',
} as const;

/** Settings the user controls for the backup feature. */
export interface BackupSettings {
  /** Absolute folder path backup zips are written to. */
  backupFolderPath: string;
  /** Whether automatic scheduled backups are enabled. */
  autoBackup: boolean;
  /** Interval between automatic backups, in hours. */
  autoBackupIntervalHours: number;
  /** Optional directory containing pg_dump / pg_restore executables. */
  pgToolsPath: string;
}

/** Snapshot of the current backup configuration. */
export interface BackupStatus {
  /** True on the host machine — backups only run there. */
  isHost: boolean;
  /** True once a backup folder has been chosen. */
  configured: boolean;
  /** The configured backup folder, if any. */
  backupFolderPath: string | null;
  /** Whether automatic backups are enabled. */
  autoBackup: boolean;
  /** Interval between automatic backups, in hours. */
  autoBackupIntervalHours: number;
  /** Optional directory containing the Postgres client tools. */
  pgToolsPath: string;
  /** ISO timestamp of the last successful backup, if any. */
  lastBackupAt: string | null;
}

/** A backup .zip as listed from the configured folder. */
export interface BackupFile {
  /** File name within the backup folder; also its identifier. */
  name: string;
  /** ISO created time (file mtime). */
  createdAt: string;
  /** Size in bytes. */
  size: number | null;
}

/** Phases surfaced to the UI during a backup or restore. */
export type BackupPhase =
  | 'dumping-database'
  | 'archiving-images'
  | 'saving'
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
