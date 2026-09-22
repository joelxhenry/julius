import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import { useBackgroundActivity } from './BackgroundActivityContext';

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
  const { start: startActivity, stop: stopActivity } = useBackgroundActivity();

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

  // Listen for background seed progress from the main process.
  // In-progress work shows a subtle bottom-left pill; only the final result
  // (done / failed) surfaces as a brief, auto-dismissing notification.
  useEffect(() => {
    const cleanup = window.electron.onSeedsProgress?.((event) => {
      const id = `seed-${event.task}`;
      if (event.status === 'started') {
        startActivity(id, event.label);
      } else if (event.status === 'completed') {
        stopActivity(id);
      } else {
        stopActivity(id);
        notifications.show({
          id,
          title: event.label,
          message: event.message || 'Failed',
          color: 'red',
          autoClose: 6000,
          withCloseButton: true,
        });
      }
    });

    return () => {
      cleanup?.();
    };
  }, [startActivity, stopActivity]);

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
