import type { IpcChannel } from '../../shared/types/ipc';
import type { UpdateStatus } from '../../shared/types/update';
import type { SetupState, MachineRole } from '../../shared/types/setup';

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
      // Auto-update
      getAppVersion?: () => Promise<string>;
      checkForUpdates?: () => Promise<{ supported: boolean; status: UpdateStatus }>;
      quitAndInstallUpdate?: () => Promise<{ success: boolean }>;
      onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
      // First-run setup
      getSetupState?: () => Promise<SetupState>;
      completeSetup?: (role: MachineRole) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {};
