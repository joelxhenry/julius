import fs from 'node:fs';
import path from 'node:path';
import { BackupFile } from '../../shared/types/backup';

const BACKUP_EXTENSION = '.zip';

/**
 * Backups live as plain .zip files in a folder the user chooses — no cloud
 * API involved. Pointing that folder at one already synced by OneDrive,
 * Dropbox, or Google Drive's desktop app gets an offsite copy for free.
 */
export class LocalBackupStore {
  constructor(private folderPath: string) {}

  private ensureFolder(): void {
    fs.mkdirSync(this.folderPath, { recursive: true });
  }

  /** Move a freshly created backup into the folder, returning its listing entry. */
  public store(sourcePath: string, name: string): BackupFile {
    this.ensureFolder();
    const dest = path.join(this.folderPath, name);
    try {
      fs.renameSync(sourcePath, dest);
    } catch {
      // Cross-volume rename (e.g. temp dir on a different drive than the
      // chosen folder) isn't atomic — fall back to copy + delete.
      fs.copyFileSync(sourcePath, dest);
      fs.unlinkSync(sourcePath);
    }
    return this.toBackupFile(dest, name);
  }

  /** List backups in the folder, newest first. */
  public list(): BackupFile[] {
    this.ensureFolder();
    return fs
      .readdirSync(this.folderPath)
      .filter((f) => f.toLowerCase().endsWith(BACKUP_EXTENSION))
      .map((name) => this.toBackupFile(path.join(this.folderPath, name), name))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public getPath(name: string): string {
    const resolved = path.join(this.folderPath, name);
    // Guard against a crafted name escaping the backup folder.
    if (path.relative(this.folderPath, resolved).startsWith('..')) {
      throw new Error('Invalid backup file name.');
    }
    return resolved;
  }

  public delete(name: string): void {
    const full = this.getPath(name);
    if (fs.existsSync(full)) fs.unlinkSync(full);
  }

  /**
   * Keep only the newest `max` backups; delete the rest.
   * @returns the number of backups deleted.
   */
  public enforceRetention(max: number): number {
    const files = this.list(); // already newest-first
    const toDelete = files.slice(max);
    for (const f of toDelete) {
      try {
        this.delete(f.name);
      } catch (err) {
        console.warn(`Failed to prune old backup ${f.name}:`, err);
      }
    }
    return toDelete.length;
  }

  private toBackupFile(fullPath: string, name: string): BackupFile {
    const stat = fs.statSync(fullPath);
    return { name, createdAt: stat.mtime.toISOString(), size: stat.size };
  }
}
