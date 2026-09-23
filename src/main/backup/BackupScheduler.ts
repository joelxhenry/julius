import { BrowserWindow } from 'electron';
import { ConfigManager } from '../config/ConfigManager';
import { GoogleDriveService } from '../services/GoogleDriveService';
import { BackupService } from '../services/BackupService';
import { BackupController } from '../controllers/BackupController';
import { BackupIpc, BackupProgress } from '../../shared/types/backup';

/** How often to check whether a scheduled backup is due. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Runs automatic backups on a schedule while the app is open. Each tick checks
 * whether auto-backup is enabled, Drive is connected, and the configured
 * interval has elapsed since the last successful backup; if so it runs one in
 * the background. `pg_dump` runs as its own process against the live database,
 * so this does not disturb the app's connection pool.
 */
export class BackupScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private getWindow: () => BrowserWindow | null) {}

  start(): void {
    if (this.timer) return;
    // Check shortly after startup, then on a fixed cadence.
    setTimeout(() => void this.tick(), 30 * 1000);
    this.timer = setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private isDue(): boolean {
    const cfg = new ConfigManager().getGoogleDriveConfig();
    if (!cfg.autoBackup || !cfg.refreshToken) return false;
    const intervalMs = (cfg.autoBackupIntervalHours ?? 24) * 60 * 60 * 1000;
    const last = cfg.lastBackupAt ? Date.parse(cfg.lastBackupAt) : 0;
    return Date.now() - last >= intervalMs;
  }

  private async tick(): Promise<void> {
    if (this.running || !this.isDue()) return;

    this.running = true;
    try {
      const configManager = new ConfigManager();
      const driveService = new GoogleDriveService(configManager);
      const backupService = new BackupService(configManager);
      const controller = new BackupController(configManager, driveService, backupService);

      const emit = (p: BackupProgress) => {
        const win = this.getWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(BackupIpc.PROGRESS, p);
        }
      };

      console.log('[BackupScheduler] Running scheduled backup…');
      const result = await controller.backupNow(emit);
      if (result.success) {
        console.log(`[BackupScheduler] Scheduled backup complete: ${result.data.file.name}`);
      } else {
        console.error('[BackupScheduler] Scheduled backup failed:', result.error);
      }
    } catch (err) {
      console.error('[BackupScheduler] Scheduled backup error:', err);
    } finally {
      this.running = false;
    }
  }
}
