import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { IconUserCheck } from '@tabler/icons-react';
import { IpcChannel } from '../../shared/types/ipc';
import { useAuth } from '../contexts/AuthContext';
import type { SafeEmployee } from '../contexts/AuthContext';
import { AccessCodeConfirmModal, ConfirmedActor } from '../components/auth/AccessCodeConfirmModal';

/**
 * Result of an access-code confirmation. Always carries the actor whose code was
 * accepted; `isCurrentUser` distinguishes the signed-in user confirming their
 * own action from another authorised user being put "on record".
 */
export type ConfirmResult = ConfirmedActor;

export interface ConfirmActionOptions {
  /** Permission the entered code must grant (e.g. CREATE_INVOICE). */
  permissionCode: string;
  /** Human-readable action, e.g. "Record payment for INV-1024". */
  actionLabel?: string;
  /** Optional structured context stored with the audit record. */
  context?: Record<string, unknown>;
}

interface PendingRequest extends ConfirmActionOptions {
  resolve: (result: ConfirmResult | null) => void;
}

interface ActionConfirmContextType {
  /**
   * Require an access code before a financial action. Resolves with the actor if
   * a valid, permitted code was entered (recording + notifying when it belongs to
   * a different user), or null if cancelled. The logged-in session never changes.
   */
  confirmAction: (options: ConfirmActionOptions) => Promise<ConfirmResult | null>;
}

const ActionConfirmContext = createContext<ActionConfirmContextType | undefined>(undefined);

/**
 * Put an authorising user "on record" for a financial action: write an audit row
 * and surface an "On Record" notification. Call this only when the confirmed
 * actor differs from the signed-in user. Recording failures never throw — they
 * are logged for follow-up so the action itself is not blocked.
 */
export async function recordActionAuthorization(
  user: SafeEmployee | null,
  actor: ConfirmedActor,
  options: ConfirmActionOptions
): Promise<void> {
  try {
    await window.electron.invoke(IpcChannel.RECORD_ACCESS_OVERRIDE, {
      permissionCode: options.permissionCode,
      actionLabel: options.actionLabel || null,
      requestedById: user?.id ?? null,
      requestedByName: user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username || `Employee #${user.id}`
        : null,
      grantedById: actor.employeeId,
      grantedByName: actor.employeeName,
      context: options.context ?? null,
      notes: null,
    });
  } catch (err) {
    console.error('[ActionConfirm] Failed to record authorization:', err);
  }

  notifications.show({
    title: 'On Record',
    message: `${actor.employeeName} is on record for this action`,
    color: 'blue',
    icon: <IconUserCheck size={18} />,
  });
}

export function ActionConfirmProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const confirmAction = useCallback((options: ConfirmActionOptions) => {
    return new Promise<ConfirmResult | null>((resolve) => {
      const req: PendingRequest = { ...options, resolve };
      pendingRef.current = req;
      setPending(req);
    });
  }, []);

  const settle = useCallback((result: ConfirmResult | null) => {
    const req = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    req?.resolve(result);
  }, []);

  const handleConfirmed = useCallback(
    async (actor: ConfirmedActor) => {
      const req = pendingRef.current;
      if (!req) return;

      // A different, authorised user approved the action → put them on record.
      // The session stays signed in as the original user throughout.
      if (!actor.isCurrentUser) {
        await recordActionAuthorization(user, actor, req);
      }

      settle(actor);
    },
    [settle, user]
  );

  const handleCancel = useCallback(() => settle(null), [settle]);

  const value = useMemo<ActionConfirmContextType>(() => ({ confirmAction }), [confirmAction]);

  return (
    <ActionConfirmContext.Provider value={value}>
      {children}
      <AccessCodeConfirmModal
        opened={!!pending}
        permissionCode={pending?.permissionCode ?? ''}
        actionLabel={pending?.actionLabel}
        currentUserId={user?.id ?? null}
        onConfirmed={handleConfirmed}
        onCancel={handleCancel}
      />
    </ActionConfirmContext.Provider>
  );
}

export function useActionConfirm() {
  const ctx = useContext(ActionConfirmContext);
  if (ctx === undefined) {
    throw new Error('useActionConfirm must be used within an ActionConfirmProvider');
  }
  return ctx;
}
