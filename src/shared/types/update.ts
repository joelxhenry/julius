/**
 * Auto-update IPC contract shared between the main and renderer processes.
 *
 * These channels are intentionally NOT part of the `IpcChannel` enum: the data
 * handler cleanup in `registerIpcHandlers` iterates the enum and removes every
 * handler on database reconnect. Update handlers must survive reconnects, so we
 * register them under their own raw channel names via dedicated preload methods.
 */
export const UpdateIpc = {
  /** invoke: trigger a manual update check. */
  CHECK: 'updates:check',
  /** invoke: quit and install a downloaded update. */
  QUIT_AND_INSTALL: 'updates:quit-and-install',
  /** invoke: read the running app version. */
  GET_VERSION: 'updates:get-version',
  /** push (main -> renderer): update lifecycle status. */
  STATUS: 'updates:status',
} as const;

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  /** Version string of the pending update, when known. */
  version?: string;
  /** Release name/notes header from the feed, when provided. */
  releaseName?: string;
  /** Error message when state === 'error'. */
  error?: string;
  /** True when this status resulted from a user-initiated check. */
  manual?: boolean;
}
