import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel } from './shared/types/ipc';

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
});

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
