import fs from 'node:fs';
import path from 'node:path';
import { ConfigManager } from '../config/ConfigManager';
import { BackupService } from '../services/BackupService';
import { LocalBackupStore } from '../services/LocalBackupStore';
import {
  BackupFile,
  BackupProgress,
  BackupSettings,
  BackupStatus,
} from '../../shared/types/backup';
import { reportError } from '../services/errorSanitizer';

/** Maximum number of backups to retain in the folder. */
const MAX_BACKUPS = 5;

type ProgressReporter = (p: BackupProgress) => void;

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Ties the local backup folder and the backup packager together and exposes
 * the operations the renderer drives over IPC. Every method returns the
 * app's standard `{ success, data | error }` envelope.
 *
 * Backups only ever run on the host machine — it's the one with direct
 * access to the database and the image store. Every mutating method rejects
 * on a client machine.
 */
export class BackupController {
  constructor(
    private configManager: ConfigManager,
    private backupService: BackupService
  ) {}

  getStatus(): Result<BackupStatus> {
    try {
      const cfg = this.configManager.getBackupConfig();
      return {
        success: true,
        data: {
          isHost: this.configManager.getRole() === 'host',
          configured: Boolean(cfg.backupFolderPath),
          backupFolderPath: cfg.backupFolderPath ?? null,
          autoBackup: cfg.autoBackup ?? false,
          autoBackupIntervalHours: cfg.autoBackupIntervalHours ?? 24,
          pgToolsPath: cfg.pgToolsPath ?? '',
          lastBackupAt: cfg.lastBackupAt ?? null,
        },
      };
    } catch (error) {
      return this.fail(error);
    }
  }

  /** Persist backup settings (folder, schedule, pg tools path). */
  saveSettings(settings: Partial<BackupSettings>): Result<null> {
    const hostError = this.requireHost();
    if (hostError) return hostError;
    try {
      const partial: Record<string, unknown> = {};
      if (settings.backupFolderPath !== undefined) partial.backupFolderPath = settings.backupFolderPath.trim();
      if (settings.autoBackup !== undefined) partial.autoBackup = settings.autoBackup;
      if (settings.autoBackupIntervalHours !== undefined) {
        partial.autoBackupIntervalHours = Math.max(1, Math.floor(settings.autoBackupIntervalHours));
      }
      if (settings.pgToolsPath !== undefined) partial.pgToolsPath = settings.pgToolsPath.trim();

      this.configManager.saveBackupConfig(partial);
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  async listBackups(): Promise<Result<BackupFile[]>> {
    try {
      return { success: true, data: this.store().list() };
    } catch (error) {
      return this.fail(error);
    }
  }

  /** Create a backup, write it to the folder, then prune to the retention limit. */
  async backupNow(onProgress?: ProgressReporter): Promise<Result<{ file: BackupFile; pruned: number }>> {
    const hostError = this.requireHost();
    if (hostError) return hostError;

    const cfg = this.configManager.getBackupConfig();
    if (!cfg.backupFolderPath) {
      return { success: false, error: 'Choose a backup folder first.' };
    }

    let created: Awaited<ReturnType<BackupService['createBackup']>> | null = null;
    try {
      created = await this.backupService.createBackup(onProgress);

      onProgress?.({ operation: 'backup', phase: 'saving', message: 'Saving backup…', percent: null });
      const store = new LocalBackupStore(cfg.backupFolderPath);
      const file = store.store(created.zipPath, created.name);
      created = null; // the zip has been moved into the folder; nothing left to clean up

      this.configManager.saveBackupConfig({ lastBackupAt: file.createdAt });

      onProgress?.({ operation: 'backup', phase: 'pruning', message: 'Removing old backups…', percent: null });
      const pruned = store.enforceRetention(MAX_BACKUPS);

      onProgress?.({ operation: 'backup', phase: 'done', message: 'Backup complete.', percent: 100 });
      return { success: true, data: { file, pruned } };
    } catch (error) {
      onProgress?.({ operation: 'backup', phase: 'error', message: this.message(error), percent: null });
      return this.fail(error);
    } finally {
      if (created) this.cleanupZip(created.zipPath);
    }
  }

  /** Restore a backup from the configured folder by file name (destructive). */
  async restore(name: string, onProgress?: ProgressReporter): Promise<Result<{ dbName: string; createdAt: string }>> {
    const hostError = this.requireHost();
    if (hostError) return hostError;
    try {
      const filePath = this.store().getPath(name);
      const manifest = await this.backupService.restoreBackup(filePath, onProgress);
      onProgress?.({ operation: 'restore', phase: 'done', message: 'Restore complete.', percent: 100 });
      return { success: true, data: { dbName: manifest.dbName, createdAt: manifest.createdAt } };
    } catch (error) {
      onProgress?.({ operation: 'restore', phase: 'error', message: this.message(error), percent: null });
      return this.fail(error);
    }
  }

  /**
   * Restore from any local backup .zip (e.g. copied from another machine, or
   * one that predates the current backup folder setting).
   */
  async restoreFromFile(filePath: string, onProgress?: ProgressReporter): Promise<Result<{ dbName: string; createdAt: string }>> {
    const hostError = this.requireHost();
    if (hostError) return hostError;
    try {
      const manifest = await this.backupService.restoreBackup(filePath, onProgress);
      onProgress?.({ operation: 'restore', phase: 'done', message: 'Restore complete.', percent: 100 });
      return { success: true, data: { dbName: manifest.dbName, createdAt: manifest.createdAt } };
    } catch (error) {
      onProgress?.({ operation: 'restore', phase: 'error', message: this.message(error), percent: null });
      return this.fail(error);
    }
  }

  deleteBackup(name: string): Result<null> {
    const hostError = this.requireHost();
    if (hostError) return hostError;
    try {
      this.store().delete(name);
      return { success: true, data: null };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ---- helpers ------------------------------------------------------------

  private requireHost(): { success: false; error: string } | null {
    if (this.configManager.getRole() !== 'host') {
      return { success: false, error: 'Backups run on the host machine only.' };
    }
    return null;
  }

  private store(): LocalBackupStore {
    const cfg = this.configManager.getBackupConfig();
    if (!cfg.backupFolderPath) {
      throw new Error('Choose a backup folder first.');
    }
    return new LocalBackupStore(cfg.backupFolderPath);
  }

  private cleanupZip(zipPath: string): void {
    try {
      const dir = path.dirname(zipPath);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private message(error: unknown): string {
    return reportError(error, 'Unknown error', 'BackupController');
  }

  private fail(error: unknown): { success: false; error: string } {
    console.error('Backup error:', error);
    return { success: false, error: this.message(error) };
  }
}
