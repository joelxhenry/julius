import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to track user activity and refresh the auth session
 * Automatically logs out user after idle timeout
 */
export function useIdleTimeout() {
  const { isAuthenticated, isSessionValid, refreshActivity, logout, idleTimeout } = useAuth();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Activity events to track
  const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

  // Debounced activity handler
  const lastActivityRef = useRef<number>(Date.now());
  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Only refresh if more than 1 second since last refresh (debounce)
    if (now - lastActivityRef.current > 1000) {
      lastActivityRef.current = now;
      refreshActivity();
    }
  }, [refreshActivity]);

  // Set up activity listeners
  useEffect(() => {
    if (!isAuthenticated) return;

    // Add activity listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check session validity periodically
    checkIntervalRef.current = setInterval(() => {
      if (!isSessionValid) {
        logout();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      // Clean up listeners
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      // Clean up interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isAuthenticated, isSessionValid, handleActivity, logout]);

  return {
    isSessionValid,
    idleTimeout,
  };
}
