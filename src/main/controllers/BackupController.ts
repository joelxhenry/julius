import path from 'node:path';
import fs from 'node:fs';
import { ConfigManager } from '../config/ConfigManager';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { BackupService, backupTempDir } from '../services/BackupService';
import {
  BackupFile,
  BackupProgress,
  BackupSettings,
  BackupStatus,
} from '../../shared/types/backup';

/** Maximum number of backups to retain in Drive. */
const MAX_BACKUPS = 5;

type ProgressReporter = (p: BackupProgress) => void;

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Ties the Drive client and the backup packager together and exposes the
 * operations the renderer drives over IPC. Every method returns the app's
 * standard `{ success, data | error }` envelope.
 */
export class BackupController {
  constructor(
    private configManager: ConfigManager,
    private driveService: GoogleDriveService,
    private backupService: BackupService
  ) {}

  getStatus(): Result<BackupStatus> {
    try {
      const cfg = this.configManager.getGoogleDriveConfig();
      const drive = this.driveService.getStatus();
      return {
        success: true,
        data: {
          configured: drive.configured,
          connected: drive.connected,
          accountEmail: drive.accountEmail,
          autoBackup: cfg.autoBackup ?? false,
          autoBackupIntervalHours: cfg.autoBackupIntervalHours ?? 24,
          pgToolsPath: cfg.pgToolsPath ?? '',
          lastBackupAt: cfg.lastBackupAt ?? null,
          hasClientId: Boolean(cfg.clientId),
          hasClientSecret: Boolean(cfg.clientSecret),
        },
      };
    } catch (error) {
      return this.fail(error);
    }
  }

  /**
   * Persist settings. The client secret is only overwritten when a non-empty
   * value is supplied, mirroring how the DB password field is handled.
   */
  saveSettings(settings: Partial<BackupSettings>): Result<null> {
    try {
      const partial: Record<string, unknown> = {};
      if (settings.clientId !== undefined) partial.clientId = settings.clientId.trim();
      if (settings.clientSecret) partial.clientSecret = settings.clientSecret.trim();
      if (settings.autoBackup !== undefined) partial.autoBackup = settings.autoBackup;
      if (settings.autoBackupIntervalHours !== undefined) {
        partial.autoBackupIntervalHours = Math.max(1, Math.floor(settings.autoBackupIntervalHours));
      }
      if (settings.pgToolsPath !== undefined) partial.pgToolsPath = settings.pgToolsPath.trim();

      this.configManager.saveGoogleDriveConfig(partial);
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  async connect(): Promise<Result<{ accountEmail: string | null }>> {
    try {
      const result = await this.driveService.startAuthFlow();
      return { success: true, data: result };
    } catch (error) {
      return this.fail(error);
    }
  }

  disconnect(): Result<null> {
    try {
      this.driveService.disconnect();
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  async listBackups(): Promise<Result<BackupFile[]>> {
    try {
      const files = await this.driveService.listBackups();
      return { success: true, data: files };
    } catch (error) {
      return this.fail(error);
    }
  }

  /** Create a backup and upload it, then prune to the retention limit. */
  async backupNow(onProgress?: ProgressReporter): Promise<Result<{ file: BackupFile; pruned: number }>> {
    if (!this.driveService.isConnected()) {
      return { success: false, error: 'Connect Google Drive before backing up.' };
    }

    let created: Awaited<ReturnType<BackupService['createBackup']>> | null = null;
    try {
      created = await this.backupService.createBackup(onProgress);

      onProgress?.({ operation: 'backup', phase: 'uploading', message: 'Uploading to Google Drive…', percent: 0 });
      const file = await this.driveService.uploadBackup(created.zipPath, created.name, (percent) => {
        onProgress?.({ operation: 'backup', phase: 'uploading', message: 'Uploading to Google Drive…', percent });
      });

      this.configManager.saveGoogleDriveConfig({ lastBackupAt: created.manifest.createdAt });

      onProgress?.({ operation: 'backup', phase: 'pruning', message: 'Removing old backups…', percent: null });
      const pruned = await this.driveService.enforceRetention(MAX_BACKUPS);

      onProgress?.({ operation: 'backup', phase: 'done', message: 'Backup complete.', percent: 100 });
      return { success: true, data: { file, pruned } };
    } catch (error) {
      onProgress?.({ operation: 'backup', phase: 'error', message: this.message(error), percent: null });
      return this.fail(error);
    } finally {
      if (created) this.cleanupZip(created.zipPath);
    }
  }

  /** Download a backup from Drive and restore it (destructive). */
  async restore(fileId: string, onProgress?: ProgressReporter): Promise<Result<{ dbName: string; createdAt: string }>> {
    if (!this.driveService.isConnected()) {
      return { success: false, error: 'Connect Google Drive before restoring.' };
    }

    const dlDir = backupTempDir();
    const localPath = path.join(dlDir, 'restore.zip');
    try {
      onProgress?.({ operation: 'restore', phase: 'downloading', message: 'Downloading backup…', percent: 0 });
      await this.driveService.downloadBackup(fileId, localPath, (percent) => {
        onProgress?.({ operation: 'restore', phase: 'downloading', message: 'Downloading backup…', percent });
      });

      const manifest = await this.backupService.restoreBackup(localPath, onProgress);

      onProgress?.({ operation: 'restore', phase: 'done', message: 'Restore complete.', percent: 100 });
      return { success: true, data: { dbName: manifest.dbName, createdAt: manifest.createdAt } };
    } catch (error) {
      onProgress?.({ operation: 'restore', phase: 'error', message: this.message(error), percent: null });
      return this.fail(error);
    } finally {
      this.cleanupZip(localPath);
    }
  }

  async deleteBackup(fileId: string): Promise<Result<null>> {
    try {
      await this.driveService.deleteBackup(fileId);
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  /** Download a backup to a user-chosen local path (no restore). */
  async downloadToPath(fileId: string, destPath: string, onProgress?: ProgressReporter): Promise<Result<null>> {
    try {
      onProgress?.({ operation: 'restore', phase: 'downloading', message: 'Downloading backup…', percent: 0 });
      await this.driveService.downloadBackup(fileId, destPath, (percent) => {
        onProgress?.({ operation: 'restore', phase: 'downloading', message: 'Downloading backup…', percent });
      });
      onProgress?.({ operation: 'restore', phase: 'done', message: 'Download complete.', percent: 100 });
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ---- helpers ------------------------------------------------------------

  private cleanupZip(zipPath: string): void {
    try {
      const dir = path.dirname(zipPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private fail(error: unknown): { success: false; error: string } {
    console.error('Backup error:', error);
    return { success: false, error: this.message(error) };
  }
}
