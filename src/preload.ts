import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel } from './shared/types/ipc';
import { UpdateIpc, type UpdateStatus } from './shared/types/update';
import { SetupIpc, type SetupState, type MachineRole } from './shared/types/setup';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  invoke: <T extends IpcChannel>(
    channel: T,
    data?: unknown
  ): Promise<unknown> => {
    return ipcRenderer.invoke(channel, data);
  },
  onDatabaseError: (callback: (error: { message: string; error: string }) => void) => {
    ipcRenderer.on('database:connection-error', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('database:connection-error');
    };
  },
  onSeedsProgress: (
    callback: (event: {
      task: string;
      label: string;
      status: 'started' | 'completed' | 'error';
      message?: string;
    }) => void
  ) => {
    const listener = (_: unknown, data: any) => callback(data);
    ipcRenderer.on('seeds:progress', listener);
    return () => {
      ipcRenderer.removeListener('seeds:progress', listener);
    };
  },

  // ===== Auto-update =====
  getAppVersion: (): Promise<string> => ipcRenderer.invoke(UpdateIpc.GET_VERSION),
  checkForUpdates: (): Promise<{ supported: boolean; status: UpdateStatus }> =>
    ipcRenderer.invoke(UpdateIpc.CHECK),
  quitAndInstallUpdate: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(UpdateIpc.QUIT_AND_INSTALL),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    const listener = (_: unknown, data: UpdateStatus) => callback(data);
    ipcRenderer.on(UpdateIpc.STATUS, listener);
    return () => {
      ipcRenderer.removeListener(UpdateIpc.STATUS, listener);
    };
  },

  // ===== First-run setup =====
  getSetupState: (): Promise<SetupState> => ipcRenderer.invoke(SetupIpc.GET_STATE),
  completeSetup: (role: MachineRole): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(SetupIpc.COMPLETE, { role }),
});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
