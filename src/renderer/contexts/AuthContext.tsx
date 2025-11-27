import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Employee } from '../../main/database/schema';

interface AuthContextType {
  employee: Employee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  verifyPIN: (pin: string) => Promise<boolean>;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'turbo-julius-auth';

interface StoredAuth {
  employee: Employee;
  timestamp: number;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved session on mount
  useEffect(() => {
    const loadSavedSession = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { employee: storedEmployee, timestamp }: StoredAuth = JSON.parse(stored);

          // Check if session is less than 24 hours old
          const hoursSinceLogin = (Date.now() - timestamp) / (1000 * 60 * 60);
          if (hoursSinceLogin < 24) {
            setEmployee(storedEmployee);
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error('Failed to load saved session:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedSession();
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    try {
      // Find employee by username
      const result = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_BY_USERNAME, { username });
      const foundEmployee = result.data || result;

      if (!foundEmployee) {
        throw new Error('Invalid username or PIN');
      }

      // Verify PIN - backend should hash and compare
      // For now, we'll create a simple verification endpoint
      // TODO: Add VERIFY_EMPLOYEE_PIN IPC channel
      const verifyResult = await window.electron.invoke(IpcChannel.GET_EMPLOYEE_BY_USERNAME, { username });

      if (!verifyResult) {
        throw new Error('Invalid username or PIN');
      }

      // Store employee data
      setEmployee(foundEmployee);

      // Save to localStorage
      const authData: StoredAuth = {
        employee: foundEmployee,
        timestamp: Date.now(),
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setEmployee(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const verifyPIN = useCallback(async (pin: string): Promise<boolean> => {
    if (!employee) return false;

    try {
      // TODO: Implement PIN verification via IPC
      // For now, return true
      return true;
    } catch (error) {
      console.error('PIN verification failed:', error);
      return false;
    }
  }, [employee]);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    // TODO: Implement permission checking based on employee role
    // For now, return true to allow development
    return true;
  }, []);

  const value: AuthContextType = {
    employee,
    isAuthenticated: !!employee,
    isLoading,
    login,
    logout,
    verifyPIN,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login will be handled by router
    return null;
  }

  return <>{children}</>;
}
