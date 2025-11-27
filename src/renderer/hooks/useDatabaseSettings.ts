import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { DatabaseConfig } from '../../main/config/types';

export function useDatabaseSettings() {
  const [config, setConfig] = useState<Omit<DatabaseConfig, 'password'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected');

  const getConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_DATABASE_CONFIG, undefined);
      setConfig(result.data || result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: DatabaseConfig) => {
    try {
      await window.electron.invoke(IpcChannel.UPDATE_DATABASE_CONFIG, newConfig);
      const { password, ...safeConfig } = newConfig;
      setConfig(safeConfig);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const testConnection = useCallback(async (testConfig: DatabaseConfig) => {
    setConnectionStatus('testing');
    try {
      const result = await window.electron.invoke(IpcChannel.TEST_DATABASE_CONNECTION, testConfig);
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
      return result;
    } catch (err) {
      setConnectionStatus('disconnected');
      setError(err as Error);
      throw err;
    }
  }, []);

  const reconnect = useCallback(async () => {
    try {
      const result = await window.electron.invoke(IpcChannel.RECONNECT_DATABASE, undefined);
      setConnectionStatus(result.success ? 'connected' : 'disconnected');
      return result;
    } catch (err) {
      setConnectionStatus('disconnected');
      setError(err as Error);
      throw err;
    }
  }, []);

  useEffect(() => {
    getConfig();
  }, [getConfig]);

  return {
    config,
    loading,
    error,
    connectionStatus,
    getConfig,
    updateConfig,
    testConnection,
    reconnect,
  };
}
