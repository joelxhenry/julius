import type { IpcChannel } from '../../shared/types/ipc';

declare global {
  interface Window {
    electron: {
      invoke: <T extends IpcChannel>(
        channel: T,
        data?: unknown
      ) => Promise<any>;
      onDatabaseError?: (callback: (error: { message: string; error: string }) => void) => () => void;
      onSeedsProgress?: (
        callback: (event: {
          task: string;
          label: string;
          status: 'started' | 'completed' | 'error';
          message?: string;
        }) => void
      ) => () => void;
    };
  }
}

export {};
