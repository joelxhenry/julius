import type { IpcChannel } from '../../shared/types/ipc';
import type { UpdateStatus } from '../../shared/types/update';
import type { SetupState, MachineRole } from '../../shared/types/setup';
import type {
  BackupStatus,
  BackupFile,
  BackupSettings,
  BackupProgress,
} from '../../shared/types/backup';

type BackupResult<T> = { success: true; data: T } | { success: false; error: string };

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
      // Google Drive backup
      getBackupStatus?: () => Promise<BackupResult<BackupStatus>>;
      saveBackupSettings?: (settings: Partial<BackupSettings>) => Promise<BackupResult<null>>;
      connectGoogleDrive?: () => Promise<BackupResult<{ accountEmail: string | null }>>;
      disconnectGoogleDrive?: () => Promise<BackupResult<null>>;
      backupNow?: () => Promise<BackupResult<{ file: BackupFile; pruned: number }>>;
      listBackups?: () => Promise<BackupResult<BackupFile[]>>;
      restoreBackup?: (fileId: string) => Promise<BackupResult<{ dbName: string; createdAt: string }>>;
      deleteBackup?: (fileId: string) => Promise<BackupResult<null>>;
      downloadBackup?: (fileId: string, name: string) => Promise<BackupResult<null>>;
      onBackupProgress?: (callback: (progress: BackupProgress) => void) => () => void;
    };
  }
}

export {};
