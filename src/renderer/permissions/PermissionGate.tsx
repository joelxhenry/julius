import React, { useCallback, useMemo, useState } from 'react';
import { usePermissions } from './usePermissions';
import { AccessDeniedView } from './AccessDeniedView';

interface PermissionGateProps {
  /** Required permission code(s). */
  permission: string | string[];
  /** When multiple codes are given, require ANY instead of ALL. */
  requireAny?: boolean;
  /**
   * How to render when the user lacks permission:
   * - 'message' (default): show an AccessDeniedView (or `fallback`)
   * - 'hide': render nothing
   */
  mode?: 'message' | 'hide';
  /** Custom denied UI (overrides the default AccessDeniedView). */
  fallback?: React.ReactNode;
  /**
   * Allow a second user to authorise access. Adds a "Request access" button to
   * the denied state; on grant the children render until the grant is consumed
   * or expires. Only meaningful with a single permission code.
   */
  allowOverride?: boolean;
  /** Human-readable action label recorded with the override audit. */
  actionLabel?: string;
  /** Structured context recorded with the override audit. */
  context?: Record<string, unknown>;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on permissions.
 *
 * Examples:
 *   <PermissionGate permission="VIEW_REPORTS"> ...page... </PermissionGate>
 *   <PermissionGate permission="MANAGE_SETTINGS" mode="hide"> ...tab... </PermissionGate>
 *   <PermissionGate permission="VOID_PAYMENT" allowOverride> ...section... </PermissionGate>
 */
export function PermissionGate({
  permission,
  requireAny = false,
  mode = 'message',
  fallback,
  allowOverride = false,
  actionLabel,
  context,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll, requestOverride } = usePermissions();
  const codes = useMemo(
    () => (Array.isArray(permission) ? permission : [permission]),
    [permission]
  );
  const [requesting, setRequesting] = useState(false);

  const allowed = codes.length === 1 ? can(codes[0]) : requireAny ? canAny(codes) : canAll(codes);

  const handleRequestAccess = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      // Overrides are per-code; use the first code as the gate.
      await requestOverride({ permissionCode: codes[0], actionLabel, context });
    } finally {
      setRequesting(false);
    }
  }, [requesting, requestOverride, codes, actionLabel, context]);

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'hide' && !allowOverride) {
    return null;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <AccessDeniedView
      permission={permission}
      onRequestAccess={allowOverride ? handleRequestAccess : undefined}
    />
  );
}
