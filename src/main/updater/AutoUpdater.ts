import { app, autoUpdater, ipcMain, BrowserWindow } from 'electron';
import { updateElectronApp, UpdateSourceType } from 'update-electron-app';
import { UpdateIpc, UpdateStatus } from '../../shared/types/update';

const GITHUB_REPO = 'joelxhenry/julius';
const UPDATE_CHECK_INTERVAL = '1 hour';

let mainWindow: BrowserWindow | null = null;
let feedInitialized = false;
let handlersRegistered = false;
/** Tracks whether the in-flight check was triggered by the user. */
let manualCheckPending = false;
let lastStatus: UpdateStatus = { state: 'idle' };

/**
 * True only when the running build can actually receive Squirrel updates:
 * a packaged Windows build. Dev runs and other platforms fall back to a
 * "check unavailable" response so the UI can degrade gracefully.
 */
function canAutoUpdate(): boolean {
  return app.isPackaged && process.platform === 'win32';
}

function broadcast(status: UpdateStatus): void {
  lastStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(UpdateIpc.STATUS, status);
  }
}

/**
 * Attach listeners to Electron's autoUpdater and translate its events into the
 * renderer-facing status contract. `update-electron-app` drives the feed and
 * periodic checks; we own notification so the UX stays under app control.
 */
function wireAutoUpdaterEvents(): void {
  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking', manual: manualCheckPending });
  });

  autoUpdater.on('update-available', () => {
    // Electron's autoUpdater exposes version details only on download; report
    // availability now and let 'update-downloaded' fill in the version.
    broadcast({ state: 'downloading', manual: manualCheckPending });
  });

  autoUpdater.on('update-not-available', () => {
    broadcast({ state: 'not-available', manual: manualCheckPending });
    manualCheckPending = false;
  });

  autoUpdater.on(
    'update-downloaded',
    (_event, releaseNotes: string, releaseName: string) => {
      broadcast({
        state: 'downloaded',
        version: releaseName,
        releaseName,
        manual: manualCheckPending,
      });
      manualCheckPending = false;
    }
  );

  autoUpdater.on('error', (error: Error) => {
    broadcast({
      state: 'error',
      error: error?.message || 'Update failed',
      manual: manualCheckPending,
    });
    manualCheckPending = false;
  });
}

/**
 * Register update IPC handlers. Safe to call before/without a feed being
 * available — GET_VERSION always works; CHECK/QUIT degrade gracefully when the
 * build cannot auto-update (dev or non-Windows).
 */
function registerUpdaterIpc(): void {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.handle(UpdateIpc.GET_VERSION, () => app.getVersion());

  ipcMain.handle(UpdateIpc.CHECK, () => {
    if (!canAutoUpdate()) {
      const status: UpdateStatus = {
        state: 'not-available',
        manual: true,
        error: app.isPackaged
          ? 'Automatic updates are only available on Windows.'
          : 'Updates are disabled in development builds.',
      };
      broadcast(status);
      return { supported: false, status };
    }

    manualCheckPending = true;
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      manualCheckPending = false;
      const status: UpdateStatus = {
        state: 'error',
        manual: true,
        error: error instanceof Error ? error.message : 'Update check failed',
      };
      broadcast(status);
      return { supported: true, status };
    }
    return { supported: true, status: { state: 'checking', manual: true } as UpdateStatus };
  });

  ipcMain.handle(UpdateIpc.QUIT_AND_INSTALL, () => {
    if (!canAutoUpdate()) return { success: false };
    autoUpdater.quitAndInstall();
    return { success: true };
  });
}

/**
 * Initialize auto-updates. Registers IPC handlers unconditionally and, on
 * packaged Windows builds, wires the GitHub Releases feed + periodic checks.
 *
 * @param window the main window that receives status broadcasts.
 */
export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window;
  registerUpdaterIpc();

  if (!canAutoUpdate()) {
    console.log('Auto-update disabled (not a packaged Windows build).');
    return;
  }

  if (feedInitialized) return;
  feedInitialized = true;

  try {
    wireAutoUpdaterEvents();
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: GITHUB_REPO,
      },
      updateInterval: UPDATE_CHECK_INTERVAL,
      // We render our own prompt from the status events above.
      notifyUser: false,
    });
    console.log('Auto-updater initialized against GitHub Releases feed.');
  } catch (error) {
    console.error('Failed to initialize auto-updater:', error);
  }
}

/** Latest known status, for late subscribers. */
export function getLastUpdateStatus(): UpdateStatus {
  return lastStatus;
}
