import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getRoutePermission } from '../router/permissions';
import { useAccessOverride, OverrideGrant, RequestOverrideOptions } from './AccessOverrideContext';

export interface UsePermissions {
  /** True if the base user has the permission OR an active override grant exists. */
  can: (permissionCode: string) => boolean;
  /** True only if the base logged-in user has the permission (ignores overrides). */
  canBase: (permissionCode: string) => boolean;
  /** True if ANY of the codes is permitted (base or override). */
  canAny: (permissionCodes: string[]) => boolean;
  /** True if ALL of the codes are permitted (base or override). */
  canAll: (permissionCodes: string[]) => boolean;
  /**
   * True if the user may reach a route path. Public / auth-only routes are
   * always accessible; permission-gated routes resolve via the route's code.
   * Use this to hide nav items, cards, and section links the user can't open.
   */
  canAccessPath: (path: string) => boolean;
  /** True if a one-time override is currently active for this code. */
  hasOverride: (permissionCode: string) => boolean;
  /** Opens the authorise-by-another-user modal; resolves with a grant or null. */
  requestOverride: (options: RequestOverrideOptions) => Promise<OverrideGrant | null>;
  /** Clears a one-time grant after the action ran → reverts to the initial user. */
  consumeOverride: (permissionCode: string) => void;
  /** Whether the logged-in user is an admin. */
  isAdmin: boolean;
  /**
   * Run an action, gating it on a permission. If the base user lacks it, prompt
   * for another user's authorisation, record it, run the action once, then
   * revert. Returns true if the action ran, false if authorisation was declined.
   */
  runWithPermission: (
    options: RequestOverrideOptions,
    action: () => void | Promise<void>
  ) => Promise<boolean>;
}

/**
 * Central hook for permission checks and one-time overrides.
 *
 * `can()` is override-aware so gated UI reveals itself immediately after a grant;
 * the grant is transient and consumed by `runWithPermission`, so the effective
 * identity always reverts to the logged-in user.
 */
export function usePermissions(): UsePermissions {
  const { hasPermission } = useAuth();
  const { hasOverride, requestOverride, consumeOverride } = useAccessOverride();

  const canBase = useCallback((code: string) => hasPermission(code), [hasPermission]);

  const can = useCallback(
    (code: string) => hasPermission(code) || hasOverride(code),
    [hasPermission, hasOverride]
  );

  const canAny = useCallback((codes: string[]) => codes.some((c) => can(c)), [can]);
  const canAll = useCallback((codes: string[]) => codes.every((c) => can(c)), [can]);

  const canAccessPath = useCallback(
    (path: string) => {
      const code = getRoutePermission(path);
      // undefined (public) or null (auth-only) => no specific permission needed.
      return !code || can(code);
    },
    [can]
  );

  const isAdmin = hasPermission('ADMIN');

  const runWithPermission = useCallback(
    async (options: RequestOverrideOptions, action: () => void | Promise<void>) => {
      if (hasPermission(options.permissionCode)) {
        await action();
        return true;
      }

      const grant = await requestOverride(options);
      if (!grant) return false;

      try {
        await action();
      } finally {
        // One-shot: drop the grant so identity reverts to the initial user.
        consumeOverride(options.permissionCode);
      }
      return true;
    },
    [hasPermission, requestOverride, consumeOverride]
  );

  return {
    can,
    canBase,
    canAny,
    canAll,
    canAccessPath,
    hasOverride,
    requestOverride,
    consumeOverride,
    isAdmin,
    runWithPermission,
  };
}
