import { shell } from 'electron';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import fs from 'node:fs';
import { Transform } from 'node:stream';
import { drive as driveApi, drive_v3 } from '@googleapis/drive';
import { OAuth2Client } from 'google-auth-library';
import { ConfigManager } from '../config/ConfigManager';
import { BackupFile } from '../../shared/types/backup';

/** Folder name created in the user's Drive to hold backups. */
const BACKUP_FOLDER_NAME = 'Julius Backups';
const BACKUP_MIME = 'application/zip';

/**
 * OAuth scopes:
 * - drive.file: access only files this app creates (the backup folder), never
 *   the rest of the user's Drive.
 * - openid/email: read the connected account email for display.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
];

/** How long to wait for the user to complete browser consent. */
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

export interface DriveConnectionStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string | null;
}

/**
 * Wraps Google Drive access for the backup feature: the OAuth loopback flow,
 * uploads/downloads to a dedicated backup folder, and retention pruning.
 */
export class GoogleDriveService {
  constructor(private configManager: ConfigManager) {}

  /** True once a client id + secret have been saved. */
  public isConfigured(): boolean {
    const cfg = this.configManager.getGoogleDriveConfig();
    return Boolean(cfg.clientId && cfg.clientSecret);
  }

  /** True once an OAuth refresh token is stored. */
  public isConnected(): boolean {
    return Boolean(this.configManager.getGoogleDriveConfig().refreshToken);
  }

  public getStatus(): DriveConnectionStatus {
    const cfg = this.configManager.getGoogleDriveConfig();
    return {
      configured: Boolean(cfg.clientId && cfg.clientSecret),
      connected: Boolean(cfg.refreshToken),
      accountEmail: cfg.accountEmail ?? null,
    };
  }

  /** Build an OAuth2 client from stored credentials and an optional redirect URI. */
  private buildOAuthClient(redirectUri?: string): OAuth2Client {
    const cfg = this.configManager.getGoogleDriveConfig();
    if (!cfg.clientId || !cfg.clientSecret) {
      throw new Error('Google Drive is not configured. Enter your OAuth Client ID and Secret first.');
    }
    return new OAuth2Client({
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri,
    });
  }

  /**
   * Run the OAuth "installed app" loopback flow: spin up a temporary local
   * server, open the system browser to the consent screen, capture the
   * authorization code on redirect, and exchange it for a refresh token.
   * The refresh token + account email are persisted (encrypted).
   */
  public async startAuthFlow(): Promise<{ accountEmail: string | null }> {
    if (!this.isConfigured()) {
      throw new Error('Enter your Google OAuth Client ID and Secret before connecting.');
    }

    return new Promise<{ accountEmail: string | null }>((resolve, reject) => {
      let settled = false;
      const server = http.createServer();

      const cleanup = () => {
        try {
          server.close();
        } catch {
          /* ignore */
        }
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const timeout = setTimeout(() => {
        fail(new Error('Timed out waiting for Google authorization.'));
      }, AUTH_TIMEOUT_MS);

      server.on('error', (err) => {
        clearTimeout(timeout);
        fail(err instanceof Error ? err : new Error(String(err)));
      });

      server.on('request', async (req, res) => {
        try {
          const url = new URL(req.url || '/', `http://127.0.0.1`);
          const code = url.searchParams.get('code');
          const oauthError = url.searchParams.get('error');

          if (oauthError) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this.resultPage('Authorization was cancelled. You can close this window.'));
            clearTimeout(timeout);
            fail(new Error(`Google authorization failed: ${oauthError}`));
            return;
          }

          if (!code) {
            // Ignore favicon and other stray requests.
            res.writeHead(404);
            res.end();
            return;
          }

          const port = (server.address() as AddressInfo).port;
          const redirectUri = `http://127.0.0.1:${port}`;
          const client = this.buildOAuthClient(redirectUri);
          const { tokens } = await client.getToken(code);

          if (!tokens.refresh_token) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this.resultPage('No refresh token was returned. Remove the app from your Google account permissions and try again.'));
            clearTimeout(timeout);
            fail(new Error('Google did not return a refresh token. Revoke access at myaccount.google.com and reconnect.'));
            return;
          }

          client.setCredentials(tokens);

          // Resolve the account email for display (best-effort).
          let accountEmail: string | null = null;
          try {
            if (tokens.access_token) {
              const info = await client.getTokenInfo(tokens.access_token);
              accountEmail = info.email ?? null;
            }
          } catch {
            /* email is optional */
          }

          this.configManager.saveGoogleDriveConfig({
            refreshToken: tokens.refresh_token,
            accountEmail: accountEmail ?? undefined,
          });

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.resultPage('Google Drive connected. You can close this window and return to the app.'));

          clearTimeout(timeout);
          settled = true;
          cleanup();
          resolve({ accountEmail });
        } catch (err) {
          clearTimeout(timeout);
          fail(err instanceof Error ? err : new Error(String(err)));
        }
      });

      // Listen on an ephemeral loopback port, then open the consent screen.
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port;
        const redirectUri = `http://127.0.0.1:${port}`;
        const client = this.buildOAuthClient(redirectUri);
        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: SCOPES,
        });
        void shell.openExternal(authUrl);
      });
    });
  }

  private resultPage(message: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Julius Backup</title></head>
<body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#f8f9fa; color:#212529;">
<div style="text-align:center; max-width:420px; padding:2rem;">
<h2 style="margin:0 0 .5rem;">Julius</h2>
<p style="font-size:1rem;">${message}</p>
</div></body></html>`;
  }

  /** An authorized OAuth2 client using the stored refresh token. */
  private getAuthedClient(): OAuth2Client {
    const cfg = this.configManager.getGoogleDriveConfig();
    if (!cfg.refreshToken) {
      throw new Error('Google Drive is not connected. Connect your account first.');
    }
    const client = this.buildOAuthClient();
    client.setCredentials({ refresh_token: cfg.refreshToken });
    return client;
  }

  private getDrive(): drive_v3.Drive {
    return driveApi({ version: 'v3', auth: this.getAuthedClient() });
  }

  /** Find or create the backup folder in Drive, caching its id in config. */
  public async ensureBackupFolder(): Promise<string> {
    const cfg = this.configManager.getGoogleDriveConfig();
    const drive = this.getDrive();

    // Verify a cached folder id still exists (and isn't trashed).
    if (cfg.folderId) {
      try {
        const existing = await drive.files.get({
          fileId: cfg.folderId,
          fields: 'id, trashed',
        });
        if (existing.data.id && !existing.data.trashed) {
          return cfg.folderId;
        }
      } catch {
        // Fall through and recreate.
      }
    }

    // Look for an existing folder created by this app.
    const search = await drive.files.list({
      q: `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    const found = search.data.files?.[0]?.id;
    if (found) {
      this.configManager.saveGoogleDriveConfig({ folderId: found });
      return found;
    }

    // Create it.
    const created = await drive.files.create({
      requestBody: {
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    const folderId = created.data.id;
    if (!folderId) {
      throw new Error('Failed to create the backup folder in Google Drive.');
    }
    this.configManager.saveGoogleDriveConfig({ folderId });
    return folderId;
  }

  /**
   * Upload a local zip to the backup folder.
   * @param onProgress receives a 0-100 percentage.
   */
  public async uploadBackup(
    filePath: string,
    name: string,
    onProgress?: (percent: number) => void
  ): Promise<BackupFile> {
    const folderId = await this.ensureBackupFolder();
    const drive = this.getDrive();

    const total = fs.statSync(filePath).size;
    let uploaded = 0;
    const counter = new Transform({
      transform(chunk, _enc, cb) {
        uploaded += chunk.length;
        if (onProgress && total > 0) {
          onProgress(Math.min(100, Math.round((uploaded / total) * 100)));
        }
        cb(null, chunk);
      },
    });
    const body = fs.createReadStream(filePath).pipe(counter);

    const created = await drive.files.create({
      requestBody: { name, parents: [folderId] },
      media: { mimeType: BACKUP_MIME, body },
      fields: 'id, name, createdTime, size',
    });

    const f = created.data;
    return {
      id: f.id as string,
      name: f.name as string,
      createdAt: f.createdTime as string,
      size: f.size ? Number(f.size) : total,
    };
  }

  /** List backups in the folder, newest first. */
  public async listBackups(): Promise<BackupFile[]> {
    const folderId = await this.ensureBackupFolder();
    const drive = this.getDrive();

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, createdTime, size)',
      spaces: 'drive',
      pageSize: 100,
    });

    return (res.data.files ?? []).map((f) => ({
      id: f.id as string,
      name: f.name as string,
      createdAt: f.createdTime as string,
      size: f.size ? Number(f.size) : null,
    }));
  }

  /**
   * Download a backup to a local path.
   * @param onProgress receives a 0-100 percentage (best-effort; null size → 0).
   */
  public async downloadBackup(
    fileId: string,
    destPath: string,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    const drive = this.getDrive();

    let total = 0;
    try {
      const meta = await drive.files.get({ fileId, fields: 'size' });
      total = meta.data.size ? Number(meta.data.size) : 0;
    } catch {
      /* size is optional */
    }

    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(destPath);
      let downloaded = 0;
      const stream = res.data as NodeJS.ReadableStream;
      stream.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (onProgress && total > 0) {
          onProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        }
      });
      stream.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => resolve());
      stream.pipe(out);
    });
  }

  public async deleteBackup(fileId: string): Promise<void> {
    const drive = this.getDrive();
    await drive.files.delete({ fileId });
  }

  /**
   * Keep only the newest `max` backups; delete the rest.
   * @returns the number of backups deleted.
   */
  public async enforceRetention(max: number): Promise<number> {
    const backups = await this.listBackups(); // already newest-first
    const toDelete = backups.slice(max);
    for (const b of toDelete) {
      try {
        await this.deleteBackup(b.id);
      } catch (err) {
        console.warn(`Failed to prune old backup ${b.name}:`, err);
      }
    }
    return toDelete.length;
  }

  /** Clear stored tokens (keeps the client id/secret so the user can reconnect). */
  public disconnect(): void {
    this.configManager.saveGoogleDriveConfig({
      refreshToken: undefined,
      accountEmail: undefined,
    });
  }
}
