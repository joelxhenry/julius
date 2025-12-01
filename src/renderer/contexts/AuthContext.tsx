import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import type { Employee } from '../../main/database/schema';

// Employee type without sensitive fields
export type SafeEmployee = Omit<Employee, 'passwordHash'>;

// Default idle timeout: 3 minutes in milliseconds
const DEFAULT_IDLE_TIMEOUT = 3 * 60 * 1000;

interface AuthContextType {
  user: SafeEmployee | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionValid: boolean;
  idleTimeout: number;
  login: (username: string, password: string) => Promise<void>;
  verifyPin: (code: string) => Promise<SafeEmployee>;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  refreshActivity: () => void;
  setIdleTimeout: (timeout: number) => void;
  updateUser: (user: SafeEmployee) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'turbo-julius-auth';
const IDLE_TIMEOUT_KEY = 'turbo-julius-idle-timeout';

interface StoredAuth {
  user: SafeEmployee;
  timestamp: number;
  lastActivity: number;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeEmployee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [idleTimeout, setIdleTimeoutState] = useState<number>(() => {
    const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_IDLE_TIMEOUT;
  });

  // Check if session is still valid based on idle timeout
  const isSessionValid = useCallback(() => {
    if (!user) return false;
    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity < idleTimeout;
  }, [user, lastActivity, idleTimeout]);

  // Load saved session on mount
  useEffect(() => {
    const loadSavedSession = () => {
      try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
          const { user: storedUser, lastActivity: storedLastActivity }: StoredAuth = JSON.parse(stored);

          // Check if session is still valid (within idle timeout)
          const timeSinceActivity = Date.now() - storedLastActivity;
          if (timeSinceActivity < idleTimeout) {
            setUser(storedUser);
            setLastActivity(storedLastActivity);
          } else {
            // Session expired
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
  }, [idleTimeout]);

  // Save session to localStorage whenever user or lastActivity changes
  useEffect(() => {
    if (user) {
      const authData: StoredAuth = {
        user,
        timestamp: Date.now(),
        lastActivity,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    }
  }, [user, lastActivity]);

  // Refresh activity timestamp
  const refreshActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Set idle timeout
  const setIdleTimeout = useCallback((timeout: number) => {
    setIdleTimeoutState(timeout);
    localStorage.setItem(IDLE_TIMEOUT_KEY, timeout.toString());
  }, []);

  // Username/password login (full login)
  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.AUTHENTICATE_EMPLOYEE, { username, password });

      if (!result.success) {
        throw new Error(result.error || 'Authentication failed');
      }

      const { employee: authenticatedEmployee } = result.data;

      setUser(authenticatedEmployee);
      setLastActivity(Date.now());

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  // Code verification (quick auth using employee code)
  const verifyPin = useCallback(async (code: string): Promise<SafeEmployee> => {
    try {
      const result = await window.electron.invoke(IpcChannel.VERIFY_EMPLOYEE_PIN, { pin: code });

      if (!result.success) {
        throw new Error(result.error || 'Invalid code');
      }

      const { employee: verifiedEmployee } = result.data;

      setUser(verifiedEmployee);
      setLastActivity(Date.now());

      return verifiedEmployee;
    } catch (error) {
      console.error('Code verification failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setLastActivity(Date.now());
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  // Update user data (e.g., after profile update)
  const updateUser = useCallback((updatedUser: SafeEmployee) => {
    setUser(updatedUser);
    setLastActivity(Date.now());
  }, []);

  const hasPermission = useCallback((permissionCode: string): boolean => {
    if (!user) return false;

    // ADMIN permission bypasses all checks
    if (user.permissions && typeof user.permissions === 'object') {
      const permissions = user.permissions as Record<string, boolean>;
      if (permissions['ADMIN'] === true) return true;
      return permissions[permissionCode] === true;
    }

    // Default to true if no permissions set (backwards compatibility)
    return true;
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isSessionValid: isSessionValid(),
    idleTimeout,
    login,
    verifyPin,
    logout,
    hasPermission,
    refreshActivity,
    setIdleTimeout,
    updateUser,
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
    return null;
  }

  return <>{children}</>;
}
