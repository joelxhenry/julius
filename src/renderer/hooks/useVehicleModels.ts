import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { VehicleModel, InsertVehicleModel } from '../../main/database/schema';

export function useVehicleModels() {
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VEHICLE_MODELS, undefined);
      setVehicleModels(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const getById = useCallback(async (id: number) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VEHICLE_MODEL, { id });
      return result.data || result;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_VEHICLE_MODELS, { query });
      setVehicleModels(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (data: InsertVehicleModel) => {
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_VEHICLE_MODEL, data);
      const newModel = result.data || result;
      setVehicleModels((prev) => [...prev, newModel]);
      return newModel;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const update = useCallback(async (id: number, data: Partial<InsertVehicleModel>) => {
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_VEHICLE_MODEL, { id, data });
      const updated = result.data || result;
      setVehicleModels((prev) => prev.map((vm) => (vm.id === id ? updated : vm)));
      return updated;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const remove = useCallback(async (id: number) => {
    try {
      await window.electron.invoke(IpcChannel.DELETE_VEHICLE_MODEL, { id });
      setVehicleModels((prev) => prev.filter((vm) => vm.id !== id));
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    vehicleModels,
    loading,
    error,
    fetchAll,
    getById,
    search,
    create,
    update,
    remove,
  };
}
