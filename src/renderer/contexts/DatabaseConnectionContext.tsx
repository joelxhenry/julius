import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';

interface DatabaseConnectionContextType {
  isConnected: boolean;
  isChecking: boolean;
  connectionError: string | null;
  checkConnection: () => Promise<void>;
  reconnect: () => Promise<boolean>;
}

const DatabaseConnectionContext = createContext<DatabaseConnectionContextType | undefined>(undefined);

export function DatabaseConnectionProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await window.electron.invoke(IpcChannel.CHECK_DATABASE_STATUS, {});
      setIsConnected(result.connected);
      setConnectionError(result.error || null);
    } catch (error) {
      setIsConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Failed to check connection');
    } finally {
      setIsChecking(false);
    }
  }, []);

  const reconnect = useCallback(async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      console.log('Attempting to reconnect to database...');
      const result = await window.electron.invoke(IpcChannel.RECONNECT_DATABASE, {});
      console.log('Reconnect result:', result);
      if (result.success) {
        console.log('Connection successful, updating state...');
        setIsConnected(true);
        setConnectionError(null);
        setIsChecking(false);
        return true;
      } else {
        console.log('Connection failed:', result.error);
        setIsConnected(false);
        setConnectionError(result.error || 'Connection failed');
        setIsChecking(false);
        return false;
      }
    } catch (error) {
      console.error('Reconnect error:', error);
      setIsConnected(false);
      setConnectionError(error instanceof Error ? error.message : 'Failed to reconnect');
      setIsChecking(false);
      return false;
    }
  }, []);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Listen for database errors from main process
  useEffect(() => {
    const cleanup = window.electron.onDatabaseError?.((error) => {
      setIsConnected(false);
      setConnectionError(error.error || error.message);
    });

    return () => {
      cleanup?.();
    };
  }, []);

  const value: DatabaseConnectionContextType = {
    isConnected,
    isChecking,
    connectionError,
    checkConnection,
    reconnect,
  };

  return (
    <DatabaseConnectionContext.Provider value={value}>
      {children}
    </DatabaseConnectionContext.Provider>
  );
}

export function useDatabaseConnection() {
  const context = useContext(DatabaseConnectionContext);
  if (context === undefined) {
    throw new Error('useDatabaseConnection must be used within a DatabaseConnectionProvider');
  }
  return context;
}
