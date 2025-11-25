import type { IpcChannel, IpcRequest, IpcResponse } from '../../shared/types/ipc';

declare global {
  interface Window {
    electron: {
      invoke: <T extends IpcChannel>(
        channel: T,
        data: IpcRequest[T]
      ) => Promise<IpcResponse[T]>;
    };
  }
}

export {};
