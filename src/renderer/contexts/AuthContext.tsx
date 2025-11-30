import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Employee } from '../../main/database/schema';

// Employee type without pinHash for security
type SafeEmployee = Omit<Employee, 'pinHash'>;

interface AuthContextType {
  user: SafeEmployee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresPinChange: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updatePin: (newPin: string) => Promise<boolean>;
  hasPermission: (permissionCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'turbo-julius-auth';

interface StoredAuth {
  user: SafeEmployee;
  timestamp: number;
  requiresPinChange: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPinChange, setRequiresPinChange] = useState(false);

  // Load saved session on mount
  useEffect(() => {
    const loadSavedSession = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { user: storedUser, timestamp, requiresPinChange: storedRequiresPinChange }: StoredAuth = JSON.parse(stored);

          // Check if session is less than 24 hours old
          const hoursSinceLogin = (Date.now() - timestamp) / (1000 * 60 * 60);
          if (hoursSinceLogin < 24) {
            setUser(storedUser);
            setRequiresPinChange(storedRequiresPinChange || false);
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

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.AUTHENTICATE_EMPLOYEE, { username, password });

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      const { employee: authenticatedEmployee, requiresPinChange: needsPinChange } = result.data;

      // Store user data
      setUser(authenticatedEmployee);
      setRequiresPinChange(needsPinChange || false);

      // Save to localStorage
      const authData: StoredAuth = {
        user: authenticatedEmployee,
        timestamp: Date.now(),
        requiresPinChange: needsPinChange || false,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setRequiresPinChange(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const updatePin = useCallback(async (newPin: string): Promise<boolean> => {
    if (!user || user.id === 0) {
      // Virtual admin user - can't update PIN
      console.warn('Cannot update PIN for virtual admin user');
      return false;
    }

    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PIN, { id: user.id, newPin });

      if (result.success) {
        setRequiresPinChange(false);
        // Update stored auth
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const authData: StoredAuth = JSON.parse(stored);
          authData.requiresPinChange = false;
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('PIN update failed:', error);
      return false;
    }
  }, [user]);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!user) return false;

    // Check if user has permissions JSONB field
    if (user.permissions && typeof user.permissions === 'object') {
      const permissions = user.permissions as Record<string, boolean>;
      return permissions[permissionCode] === true;
    }

    // Default to true for admin users or if no permissions set
    return true;
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    requiresPinChange,
    login,
    logout,
    updatePin,
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
