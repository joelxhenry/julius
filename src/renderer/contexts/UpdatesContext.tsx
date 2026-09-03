import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import type { UpdateStatus } from '../../shared/types/update';

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

      // Only surface toasts for checks the user explicitly started. Background
      // checks stay silent until an update is downloaded (handled by the prompt).
      const isManual = next.manual ?? manualRef.current;

      if (next.state === 'not-available' && isManual) {
        notifications.update({
          id: NOTIFY_ID,
          title: 'No updates available',
          message: next.error || "You're on the latest version.",
          color: 'teal',
          loading: false,
          autoClose: 4000,
          withCloseButton: true,
        });
        manualRef.current = false;
      } else if (next.state === 'error' && isManual) {
        notifications.update({
          id: NOTIFY_ID,
          title: 'Update check failed',
          message: next.error || 'Could not check for updates.',
          color: 'red',
          loading: false,
          autoClose: 6000,
          withCloseButton: true,
        });
        manualRef.current = false;
      } else if (next.state === 'downloading' && isManual) {
        notifications.update({
          id: NOTIFY_ID,
          title: 'Update found',
          message: 'Downloading the latest version…',
          color: 'blue',
          loading: true,
          autoClose: false,
          withCloseButton: false,
        });
      } else if (next.state === 'downloaded') {
        // Clear any lingering "checking" toast; the prompt takes over.
        notifications.hide(NOTIFY_ID);
        manualRef.current = false;
      }
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!window.electron.checkForUpdates) return;
    manualRef.current = true;
    setBusy(true);
    notifications.show({
      id: NOTIFY_ID,
      title: 'Checking for updates…',
      message: 'Contacting the update server.',
      loading: true,
      autoClose: false,
      withCloseButton: false,
    });
    try {
      const result = await window.electron.checkForUpdates();
      // Unsupported builds (dev / non-Windows) resolve immediately with a status.
      if (!result?.supported) {
        setBusy(false);
      }
    } catch {
      setBusy(false);
      manualRef.current = false;
      notifications.update({
        id: NOTIFY_ID,
        title: 'Update check failed',
        message: 'Could not reach the update server.',
        color: 'red',
        loading: false,
        autoClose: 6000,
        withCloseButton: true,
      });
    }
  }, []);

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
