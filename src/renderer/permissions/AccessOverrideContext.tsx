import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { useAuth } from '../contexts/AuthContext';
import { RequestAccessModal } from './RequestAccessModal';

/**
 * A one-time, in-memory elevation granted by an authorised user so the currently
 * logged-in user can perform a single action they otherwise lack permission for.
 *
 * IMPORTANT: granting an override NEVER changes the logged-in session user. The
 * grant lives only in this context, is consumed after the action runs, and
 * auto-expires — so the effective identity always reverts to the initial user.
 */
export interface OverrideGrant {
  permissionCode: string;
  actionLabel: string;
  grantedById: number;
  grantedByName: string;
  notes: string;
  grantedAt: number;
  /** DB id of the recorded audit row, if recording succeeded. */
  recordId?: number;
}

export interface RequestOverrideOptions {
  permissionCode: string;
  /** Human-readable action, e.g. "Void payment #123". Used in the prompt + audit. */
  actionLabel?: string;
  /** Optional structured context stored with the audit record. */
  context?: Record<string, unknown>;
}

interface PendingRequest extends RequestOverrideOptions {
  resolve: (grant: OverrideGrant | null) => void;
}

interface AccessOverrideContextType {
  /** Active (unconsumed, unexpired) grants keyed by permission code. */
  grants: Record<string, OverrideGrant>;
  hasOverride: (permissionCode: string) => boolean;
  /** Opens the authorise-by-another-user modal; resolves with the grant or null. */
  requestOverride: (options: RequestOverrideOptions) => Promise<OverrideGrant | null>;
  /** Removes a grant (call after the elevated action completes → reverts identity). */
  consumeOverride: (permissionCode: string) => void;
  clearAllOverrides: () => void;
}

const AccessOverrideContext = createContext<AccessOverrideContextType | undefined>(undefined);

// A grant is valid for at most this long as a safety net (ms).
const OVERRIDE_TTL = 2 * 60 * 1000;

export function AccessOverrideProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [grants, setGrants] = useState<Record<string, OverrideGrant>>({});
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const isGrantValid = useCallback((grant: OverrideGrant | undefined): grant is OverrideGrant => {
    return !!grant && Date.now() - grant.grantedAt < OVERRIDE_TTL;
  }, []);

  const hasOverride = useCallback(
    (permissionCode: string) => isGrantValid(grants[permissionCode]),
    [grants, isGrantValid]
  );

  const consumeOverride = useCallback((permissionCode: string) => {
    setGrants((prev) => {
      if (!prev[permissionCode]) return prev;
      const next = { ...prev };
      delete next[permissionCode];
      return next;
    });
  }, []);

  const clearAllOverrides = useCallback(() => setGrants({}), []);

  const requestOverride = useCallback(
    (options: RequestOverrideOptions) => {
      return new Promise<OverrideGrant | null>((resolve) => {
        const req: PendingRequest = {
          permissionCode: options.permissionCode,
          actionLabel: options.actionLabel ?? '',
          context: options.context,
          resolve,
        };
        pendingRef.current = req;
        setPending(req);
      });
    },
    []
  );

  const settle = useCallback((grant: OverrideGrant | null) => {
    const req = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    if (grant) {
      setGrants((prev) => ({ ...prev, [grant.permissionCode]: grant }));
    }
    req?.resolve(grant);
  }, []);

  // Called by the modal once an authorised grantor has been verified.
  const handleGranted = useCallback(
    async (grantor: { employeeId: number; employeeName: string }, notes: string) => {
      const req = pendingRef.current;
      if (!req) return;

      const grant: OverrideGrant = {
        permissionCode: req.permissionCode,
        actionLabel: req.actionLabel,
        grantedById: grantor.employeeId,
        grantedByName: grantor.employeeName,
        notes,
        grantedAt: Date.now(),
      };

      // Record the override for auditing. Failure to record must not block the
      // action, but is surfaced in the console for follow-up.
      try {
        const result = await window.electron.invoke(IpcChannel.RECORD_ACCESS_OVERRIDE, {
          permissionCode: req.permissionCode,
          actionLabel: req.actionLabel || null,
          requestedById: user?.id ?? null,
          requestedByName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username || `Employee #${user.id}` : null,
          grantedById: grantor.employeeId,
          grantedByName: grantor.employeeName,
          context: req.context ?? null,
          notes: notes || null,
        });
        if (result?.success && result.data?.id) {
          grant.recordId = result.data.id;
        }
      } catch (err) {
        console.error('[AccessOverride] Failed to record override:', err);
      }

      settle(grant);
    },
    [settle, user]
  );

  const handleCancel = useCallback(() => settle(null), [settle]);

  const value = useMemo<AccessOverrideContextType>(
    () => ({ grants, hasOverride, requestOverride, consumeOverride, clearAllOverrides }),
    [grants, hasOverride, requestOverride, consumeOverride, clearAllOverrides]
  );

  return (
    <AccessOverrideContext.Provider value={value}>
      {children}
      <RequestAccessModal
        opened={!!pending}
        permissionCode={pending?.permissionCode ?? ''}
        actionLabel={pending?.actionLabel ?? ''}
        onGranted={handleGranted}
        onCancel={handleCancel}
      />
    </AccessOverrideContext.Provider>
  );
}

export function useAccessOverride() {
  const ctx = useContext(AccessOverrideContext);
  if (ctx === undefined) {
    throw new Error('useAccessOverride must be used within an AccessOverrideProvider');
  }
  return ctx;
}
