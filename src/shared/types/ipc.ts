import type { User, InsertUser, Note, InsertNote } from '../../main/database/schema';

export enum IpcChannel {
  // User operations
  GET_USERS = 'db:get-users',
  GET_USER = 'db:get-user',
  CREATE_USER = 'db:create-user',
  UPDATE_USER = 'db:update-user',
  DELETE_USER = 'db:delete-user',

  // Note operations
  GET_NOTES = 'db:get-notes',
  GET_NOTE = 'db:get-note',
  CREATE_NOTE = 'db:create-note',
  UPDATE_NOTE = 'db:update-note',
  DELETE_NOTE = 'db:delete-note',
}

export interface IpcRequest {
  [IpcChannel.GET_USERS]: void;
  [IpcChannel.GET_USER]: { id: number };
  [IpcChannel.CREATE_USER]: InsertUser;
  [IpcChannel.UPDATE_USER]: { id: number; data: Partial<InsertUser> };
  [IpcChannel.DELETE_USER]: { id: number };

  [IpcChannel.GET_NOTES]: { userId?: number };
  [IpcChannel.GET_NOTE]: { id: number };
  [IpcChannel.CREATE_NOTE]: InsertNote;
  [IpcChannel.UPDATE_NOTE]: { id: number; data: Partial<InsertNote> };
  [IpcChannel.DELETE_NOTE]: { id: number };
}

export interface IpcResponse {
  [IpcChannel.GET_USERS]: User[];
  [IpcChannel.GET_USER]: User | null;
  [IpcChannel.CREATE_USER]: User;
  [IpcChannel.UPDATE_USER]: User;
  [IpcChannel.DELETE_USER]: { success: boolean };

  [IpcChannel.GET_NOTES]: Note[];
  [IpcChannel.GET_NOTE]: Note | null;
  [IpcChannel.CREATE_NOTE]: Note;
  [IpcChannel.UPDATE_NOTE]: Note;
  [IpcChannel.DELETE_NOTE]: { success: boolean };
}
