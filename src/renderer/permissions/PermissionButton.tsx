import { useCallback, useState } from 'react';
import { Button, ButtonProps, Tooltip } from '@mantine/core';
import { usePermissions } from './usePermissions';
import { getPermissionByCode } from '../../shared/constants/permissions';

type DeniedBehaviour = 'disable' | 'hide' | 'elevate';

interface PermissionButtonProps extends ButtonProps {
  /** Permission code required to run the action. */
  permission: string;
  /** The action to perform when permitted. */
  onClick: () => void | Promise<void>;
  /**
   * What to do when the user lacks the permission:
   * - 'disable' (default): show a disabled button with an explanatory tooltip
   * - 'hide': render nothing
   * - 'elevate': keep enabled; clicking prompts another user to authorise, records
   *   it, runs the action once, then reverts to the current user
   */
  whenDenied?: DeniedBehaviour;
  /** Human-readable label recorded with the override audit (defaults to button text). */
  actionLabel?: string;
  /** Structured context recorded with the override audit. */
  context?: Record<string, unknown>;
  /** Tooltip shown on the disabled button (defaults to a generated message). */
  deniedTooltip?: string;
  children: React.ReactNode;
}

/**
 * A Button that enforces a permission.
 *
 * <PermissionButton permission="VOID_PAYMENT" whenDenied="elevate" onClick={voidIt}>
 *   Void Payment
 * </PermissionButton>
 */
export function PermissionButton({
  permission,
  onClick,
  whenDenied = 'disable',
  actionLabel,
  context,
  deniedTooltip,
  children,
  disabled,
  ...buttonProps
}: PermissionButtonProps) {
  const { canBase, runWithPermission } = usePermissions();
  const [busy, setBusy] = useState(false);
  const allowed = canBase(permission);

  const label = actionLabel ?? (typeof children === 'string' ? children : permission);
  const permissionLabel = getPermissionByCode(permission)?.label ?? permission;

  const handleClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (allowed) {
        await onClick();
      } else if (whenDenied === 'elevate') {
        // Prompt another user, record, run once, then revert.
        await runWithPermission({ permissionCode: permission, actionLabel: label, context }, onClick);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, allowed, whenDenied, onClick, runWithPermission, permission, label, context]);

  if (!allowed && whenDenied === 'hide') {
    return null;
  }

  // Disabled mode: render an inert button with an explanatory tooltip.
  if (!allowed && whenDenied === 'disable') {
    return (
      <Tooltip label={deniedTooltip ?? `Requires permission: ${permissionLabel}`} withArrow>
        {/* span wrapper so the tooltip works on a disabled button */}
        <span style={{ display: 'inline-flex' }}>
          <Button {...buttonProps} disabled data-permission-denied>
            {children}
          </Button>
        </span>
      </Tooltip>
    );
  }

  // Allowed, or elevate mode (enabled — click triggers authorisation if needed).
  return (
    <Button {...buttonProps} onClick={handleClick} loading={busy || buttonProps.loading} disabled={disabled}>
      {children}
    </Button>
  );
}
