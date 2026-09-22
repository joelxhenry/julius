import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { UpdateStatus } from '../../shared/types/update';
import { useBackgroundActivity } from './BackgroundActivityContext';

interface UpdatesContextType {
  /** Running application version (e.g. "1.0.0"). */
  version: string | null;
  /** Latest update lifecycle status from the main process. */
  status: UpdateStatus;
  /** True while a check/download is in flight. */
  busy: boolean;
  /** True once an update has finished downloading and is ready to install. */
  updateReady: boolean;
  /** Trigger a user-initiated update check. */
  checkForUpdates: () => Promise<void>;
  /** Restart the app to apply a downloaded update. */
  quitAndInstall: () => Promise<void>;
}

const UpdatesContext = createContext<UpdatesContextType | undefined>(undefined);

const NOTIFY_ID = 'app-update-check';

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [busy, setBusy] = useState(false);
  const { start: startActivity, stop: stopActivity } = useBackgroundActivity();
  // Guards the "up to date"/"error" toast to only fire for user-initiated checks.
  const manualRef = useRef(false);

  // Load version once on mount.
  useEffect(() => {
    window.electron.getAppVersion?.().then(setVersion).catch(() => setVersion(null));
  }, []);

  // Subscribe to update status broadcasts from the main process.
  useEffect(() => {
    const cleanup = window.electron.onUpdateStatus?.((next) => {
      setStatus(next);

      if (next.state === 'checking' || next.state === 'downloading') {
        setBusy(true);
      } else {
        setBusy(false);
      }

      // Only surface progress for checks the user explicitly started. Background
      // checks stay silent until an update is downloaded (handled by the prompt).
      const isManual = next.manual ?? manualRef.current;

      // In-progress phases drive the subtle background pill, not a toast.
      if ((next.state === 'checking' || next.state === 'downloading') && isManual) {
        startActivity(
          NOTIFY_ID,
          next.state === 'downloading' ? 'Downloading the latest version…' : 'Checking for updates…'
        );
      }

      if (next.state === 'not-available' && isManual) {
        stopActivity(NOTIFY_ID);
        notifications.show({
          id: NOTIFY_ID,
          title: 'No updates available',
          message: next.error || "You're on the latest version.",
          color: 'teal',
          autoClose: 4000,
          withCloseButton: true,
        });
        manualRef.current = false;
      } else if (next.state === 'error' && isManual) {
        stopActivity(NOTIFY_ID);
        notifications.show({
          id: NOTIFY_ID,
          title: 'Update check failed',
          message: next.error || 'Could not check for updates.',
          color: 'red',
          autoClose: 6000,
          withCloseButton: true,
        });
        manualRef.current = false;
      } else if (next.state === 'downloaded') {
        // Clear any lingering progress pill; the prompt takes over.
        stopActivity(NOTIFY_ID);
        manualRef.current = false;
      }
    });

    return () => {
      cleanup?.();
    };
  }, [startActivity, stopActivity]);

  const checkForUpdates = useCallback(async () => {
    if (!window.electron.checkForUpdates) return;
    manualRef.current = true;
    setBusy(true);
    startActivity(NOTIFY_ID, 'Checking for updates…');
    try {
      const result = await window.electron.checkForUpdates();
      // Unsupported builds (dev / non-Windows) resolve immediately with a status.
      if (!result?.supported) {
        setBusy(false);
        stopActivity(NOTIFY_ID);
      }
    } catch {
      setBusy(false);
      manualRef.current = false;
      stopActivity(NOTIFY_ID);
      notifications.show({
        id: NOTIFY_ID,
        title: 'Update check failed',
        message: 'Could not reach the update server.',
        color: 'red',
        autoClose: 6000,
        withCloseButton: true,
      });
    }
  }, [startActivity, stopActivity]);

  const quitAndInstall = useCallback(async () => {
    await window.electron.quitAndInstallUpdate?.();
  }, []);

  const value: UpdatesContextType = {
    version,
    status,
    busy,
    updateReady: status.state === 'downloaded',
    checkForUpdates,
    quitAndInstall,
  };

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

export function useUpdates() {
  const context = useContext(UpdatesContext);
  if (context === undefined) {
    throw new Error('useUpdates must be used within an UpdatesProvider');
  }
  return context;
}
