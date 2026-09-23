import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseConfig } from '../config/types';
import {
  closeDatabase,
  initDatabase,
  getDatabaseOrNull,
} from '../database';
import { ImageStorageService } from './ImageStorageService';
import { SystemSettingsService } from './SystemSettingsService';
import { BackupProgress } from '../../shared/types/backup';

const MANIFEST_NAME = 'manifest.json';
const DUMP_NAME = 'database.dump';
const IMAGES_PREFIX = 'images';
/** Bumped only if the archive layout changes incompatibly. */
const SCHEMA_VERSION = 1;

export interface BackupManifest {
  schemaVersion: number;
  appVersion: string;
  createdAt: string;
  dbName: string;
  storageType: string;
}

export interface CreatedBackup {
  /** Absolute path to the temp .zip. Caller must delete it when done. */
  zipPath: string;
  /** Suggested Drive/file name. */
  name: string;
  manifest: BackupManifest;
}

type ProgressReporter = (p: BackupProgress) => void;

/**
 * Creates and restores full-application backups: a `pg_dump` of the PostgreSQL
 * database plus the on-disk image store, packaged as a single zip. Restore
 * reverses it with `pg_restore` and repopulates the image store.
 */
export class BackupService {
  constructor(private configManager: ConfigManager) {}

  // ---- public API ---------------------------------------------------------

  /**
   * Produce a backup zip in a temp directory. The DB dump is streamed to disk
   * and the image tree is added by reference, so memory stays flat regardless
   * of database/image size.
   */
  public async createBackup(onProgress?: ProgressReporter): Promise<CreatedBackup> {
    const dbConfig = this.getDbConfig();
    const imageDir = await this.resolveImageDir();
    const storageType = await this.resolveStorageType();

    const workDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'julius-backup-'));
    const dumpPath = path.join(workDir, DUMP_NAME);

    try {
      onProgress?.({
        operation: 'backup',
        phase: 'dumping-database',
        message: 'Exporting database…',
        percent: null,
      });
      await this.pgDump(dbConfig, dumpPath);

      const manifest: BackupManifest = {
        schemaVersion: SCHEMA_VERSION,
        appVersion: app.getVersion(),
        createdAt: new Date().toISOString(),
        dbName: dbConfig.database,
        storageType,
      };

      onProgress?.({
        operation: 'backup',
        phase: 'archiving-images',
        message: 'Packaging images…',
        percent: null,
      });
      const name = `julius-backup-${this.timestampSlug(manifest.createdAt)}.zip`;
      const zipPath = path.join(workDir, name);
      await this.zip(zipPath, dumpPath, manifest, imageDir);

      // The dump is now inside the zip; drop it early to save temp space.
      this.safeUnlink(dumpPath);

      return { zipPath, name, manifest };
    } catch (err) {
      // On failure clean the whole work dir; nothing useful remains.
      this.safeRmDir(workDir);
      throw err;
    }
  }

  /**
   * Restore a backup zip: replace the database via `pg_restore` and rewrite the
   * image store. Destructive — overwrites current data. The DB pool is closed
   * before restore (to release locks) and re-initialised afterwards so the
   * restored settings are readable when repopulating images.
   */
  public async restoreBackup(zipPath: string, onProgress?: ProgressReporter): Promise<BackupManifest> {
    const workDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'julius-restore-'));
    try {
      onProgress?.({
        operation: 'restore',
        phase: 'extracting',
        message: 'Extracting backup…',
        percent: null,
      });
      await this.unzip(zipPath, workDir);

      const manifest = this.readManifest(workDir);
      const dumpPath = path.join(workDir, DUMP_NAME);
      if (!fs.existsSync(dumpPath)) {
        throw new Error('Backup archive is missing its database dump.');
      }

      const dbConfig = this.getDbConfig();

      onProgress?.({
        operation: 'restore',
        phase: 'restoring-database',
        message: 'Restoring database…',
        percent: null,
      });
      // Release the app's pool so pg_restore --clean can drop objects.
      await closeDatabase();
      await this.pgRestore(dbConfig, dumpPath);

      onProgress?.({
        operation: 'restore',
        phase: 'reconnecting',
        message: 'Reconnecting to database…',
        percent: null,
      });
      await initDatabase();

      onProgress?.({
        operation: 'restore',
        phase: 'restoring-images',
        message: 'Restoring images…',
        percent: null,
      });
      const extractedImages = path.join(workDir, IMAGES_PREFIX);
      const imageDir = await this.resolveImageDir();
      this.restoreImages(extractedImages, imageDir);

      return manifest;
    } finally {
      this.safeRmDir(workDir);
    }
  }

  // ---- database dump/restore ---------------------------------------------

  private getDbConfig(): DatabaseConfig {
    return this.configManager.load().database;
  }

  private async pgDump(cfg: DatabaseConfig, outPath: string): Promise<void> {
    const bin = this.resolvePgTool('pg_dump');
    const args = [
      '-h', cfg.host,
      '-p', String(cfg.port),
      '-U', cfg.user,
      '-d', cfg.database,
      '-F', 'c', // custom (compressed) format
      '--no-owner',
      '--no-privileges',
      '-f', outPath,
    ];
    await this.runPgTool(bin, args, cfg, 'pg_dump');
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
      throw new Error('pg_dump produced an empty file.');
    }
  }

  private async pgRestore(cfg: DatabaseConfig, dumpPath: string): Promise<void> {
    const bin = this.resolvePgTool('pg_restore');
    const args = [
      '-h', cfg.host,
      '-p', String(cfg.port),
      '-U', cfg.user,
      '-d', cfg.database,
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--single-transaction', // all-or-nothing: a failure rolls back
      dumpPath,
    ];
    await this.runPgTool(bin, args, cfg, 'pg_restore');
  }

  /** Spawn a Postgres client tool with the password supplied via env. */
  private runPgTool(
    bin: string,
    args: string[],
    cfg: DatabaseConfig,
    label: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(bin, args, {
        env: {
          ...process.env,
          PGPASSWORD: cfg.password,
          PGSSLMODE: cfg.ssl ? 'require' : 'prefer',
        },
        windowsHide: true,
      });

      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });
      child.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new Error(`${label} could not be run at "${bin}". Set the Postgres tools path in Backup settings.`));
        } else {
          reject(err);
        }
      });
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const detail = stderr.trim().split('\n').slice(-5).join('\n');
          reject(new Error(`${label} failed (exit ${code}).${detail ? `\n${detail}` : ''}`));
        }
      });
    });
  }

  /**
   * Locate a Postgres client executable. Order: configured tools path → PATH →
   * common Windows install locations. Returns a runnable path or bare command.
   */
  private resolvePgTool(tool: 'pg_dump' | 'pg_restore'): string {
    const exe = process.platform === 'win32' ? `${tool}.exe` : tool;
    const configured = this.configManager.getGoogleDriveConfig().pgToolsPath;

    if (configured) {
      const candidate = path.join(configured, exe);
      if (fs.existsSync(candidate)) return candidate;
      throw new Error(`${exe} not found in the configured Postgres tools path: ${configured}`);
    }

    // Scan common Windows install dirs (PostgreSQL installer default layout).
    if (process.platform === 'win32') {
      const roots = [
        'C:\\Program Files\\PostgreSQL',
        'C:\\Program Files (x86)\\PostgreSQL',
      ];
      for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        // Newest version dir first.
        const versions = fs
          .readdirSync(root)
          .sort((a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0));
        for (const v of versions) {
          const candidate = path.join(root, v, 'bin', exe);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }

    // Fall back to PATH; spawn will surface a clear error if it's missing.
    return exe;
  }

  // ---- zip / unzip --------------------------------------------------------

  private zip(
    zipPath: string,
    dumpPath: string,
    manifest: BackupManifest,
    imageDir: string
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 6 } });

      output.on('close', () => resolve());
      output.on('error', reject);
      archive.on('error', reject);
      archive.on('warning', (warn) => {
        if ((warn as { code?: string }).code !== 'ENOENT') reject(warn);
      });

      archive.pipe(output);
      archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_NAME });
      archive.file(dumpPath, { name: DUMP_NAME });
      if (fs.existsSync(imageDir)) {
        archive.directory(imageDir, IMAGES_PREFIX);
      }
      void archive.finalize();
    });
  }

  private unzip(zipPath: string, destDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: destDir }))
        .on('close', () => resolve())
        .on('error', reject);
    });
  }

  private readManifest(workDir: string): BackupManifest {
    const manifestPath = path.join(workDir, MANIFEST_NAME);
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Backup archive is missing its manifest.');
    }
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch {
      throw new Error('Backup manifest is corrupted.');
    }
    if (manifest.schemaVersion > SCHEMA_VERSION) {
      throw new Error(
        `This backup was made by a newer app version (format ${manifest.schemaVersion}). Update the app to restore it.`
      );
    }
    return manifest;
  }

  // ---- images -------------------------------------------------------------

  /**
   * Resolve the active image storage root, honouring the LAN storage setting
   * when the database is available. Falls back to the default local path.
   */
  private async resolveImageDir(): Promise<string> {
    const imageStorage = new ImageStorageService();
    const db = getDatabaseOrNull();
    if (db) {
      try {
        await imageStorage.initializeFromSettings(new SystemSettingsService(db));
      } catch (err) {
        console.warn('Falling back to default image storage path:', err);
      }
    }
    return imageStorage.getStorageInfo().path;
  }

  private async resolveStorageType(): Promise<string> {
    const imageStorage = new ImageStorageService();
    const db = getDatabaseOrNull();
    if (db) {
      try {
        await imageStorage.initializeFromSettings(new SystemSettingsService(db));
      } catch {
        /* default */
      }
    }
    return imageStorage.getStorageInfo().type;
  }

  /** Replace the contents of the image store with the extracted images. */
  private restoreImages(extractedImages: string, imageDir: string): void {
    fs.mkdirSync(imageDir, { recursive: true });

    // Clear existing contents (keep the root directory itself).
    for (const entry of fs.readdirSync(imageDir)) {
      this.safeRmDir(path.join(imageDir, entry));
    }

    if (!fs.existsSync(extractedImages)) {
      // Backup had no images; nothing to copy.
      return;
    }
    fs.cpSync(extractedImages, imageDir, { recursive: true });
  }

  // ---- helpers ------------------------------------------------------------

  private timestampSlug(iso: string): string {
    // 2026-09-22T14:30:05.123Z -> 20260922-143005
    return iso.replace(/[-:]/g, '').replace('T', '-').replace(/\..+$/, '');
  }

  private safeUnlink(p: string): void {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }

  private safeRmDir(p: string): void {
    try {
      if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** Convenience: default temp directory for ad-hoc downloads. */
export function backupTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'julius-dl-'));
}
