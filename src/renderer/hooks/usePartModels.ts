import { useState, useCallback } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { PartModel, InsertPartModel } from '../../main/database/schema';

export function usePartModels() {
  const [partModels, setPartModels] = useState<PartModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchByPart = useCallback(async (partId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART_MODELS_BY_PART, { partId });
      setPartModels(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchByVehicle = useCallback(async (vehicleModelId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_PART_MODELS_BY_VEHICLE, { vehicleModelId });
      setPartModels(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertPartModel) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PART_MODEL, data);
      const newPartModel = result.data || result;
      setPartModels((prev) => [...prev, newPartModel]);
      return newPartModel;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const createBulk = useCallback(async (modelsData: InsertPartModel[]) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_PART_MODELS_BULK, modelsData);
      const newModels = result.data || result;
      setPartModels((prev) => [...prev, ...newModels]);
      return newModels;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertPartModel>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_PART_MODEL, { id, data });
      const updated = result.data || result;
      setPartModels((prev) => prev.map((pm) => (pm.id === id ? updated : pm)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_PART_MODEL, { id });
      setPartModels((prev) => prev.filter((pm) => pm.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    partModels,
    loading,
    error,
    fetchByPart,
    fetchByVehicle,
    create,
    createBulk,
    update,
    remove,
  };
}
