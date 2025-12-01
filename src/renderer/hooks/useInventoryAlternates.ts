import { useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';

export interface InventoryAlternate {
  id: number;
  partNo: string;
  alternateNo: string;
  supplier: string | null;
  createdAt: Date;
}

export interface CreateAlternateData {
  partNo: string;
  alternateNo: string;
  supplier?: string | null;
}

export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function useInventoryAlternates() {
  const getAlternates = useCallback(async (): Promise<IpcResult<InventoryAlternate[]>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY_ALTERNATES, {});
  }, []);

  const getAlternatesByPart = useCallback(async (
    partNo: string
  ): Promise<IpcResult<InventoryAlternate[]>> => {
    return window.electron.invoke(IpcChannel.GET_INVENTORY_ALTERNATES_BY_PART, { partNo });
  }, []);

  const createAlternate = useCallback(async (
    data: CreateAlternateData
  ): Promise<IpcResult<InventoryAlternate>> => {
    return window.electron.invoke(IpcChannel.CREATE_INVENTORY_ALTERNATE, data);
  }, []);

  const deleteAlternate = useCallback(async (
    id: number
  ): Promise<IpcResult<boolean>> => {
    return window.electron.invoke(IpcChannel.DELETE_INVENTORY_ALTERNATE, { id });
  }, []);

  return {
    getAlternates,
    getAlternatesByPart,
    createAlternate,
    deleteAlternate,
  };
}
