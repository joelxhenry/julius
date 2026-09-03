import type { MachineRole } from '../../main/config/types';

export type { MachineRole };

/**
 * First-run setup IPC contract. Like the update channels, these are kept OUT of
 * the `IpcChannel` enum so the data-handler cleanup on database reconnect never
 * strips them — they must remain callable before and during setup, while the
 * database may be disconnected.
 */
export const SetupIpc = {
  /** invoke: read whether the first-run wizard should run. */
  GET_STATE: 'setup:get-state',
  /** invoke: persist the chosen role and mark setup complete. */
  COMPLETE: 'setup:complete',
} as const;

export interface SetupState {
  needsSetup: boolean;
  role: MachineRole | null;
}
