import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader, Badge } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { PINInput } from './PINInput';
import { IpcChannel } from '../../../shared/types/ipc';
import { getPermissionByCode } from '../../../shared/constants/permissions';

export interface ConfirmedActor {
  employeeId: number;
  employeeName: string;
  /** True when the entered code belongs to the currently signed-in user. */
  isCurrentUser: boolean;
}

interface AccessCodeConfirmModalProps {
  opened: boolean;
  /** Permission the entered code must grant (e.g. CREATE_INVOICE). */
  permissionCode: string;
  /** Human-readable action, e.g. "Record payment for INV-1024". */
  actionLabel?: string;
  /** Id of the signed-in user, used to detect whether the code is their own. */
  currentUserId: number | null;
  onConfirmed: (actor: ConfirmedActor) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Access-code gate for financial actions (create invoice / quotation, record
 * payment). The code is ALWAYS required to complete the action.
 *
 * Verification uses VERIFY_ACCESS_CODE, which resolves the code owner's identity
 * and effective permissions WITHOUT switching the logged-in session. If the code
 * belongs to a different, suitably-permissioned user, that user is returned as
 * the actor so the caller can put them "on record" — the session stays signed in
 * as the original user.
 */
export function AccessCodeConfirmModal({
  opened,
  permissionCode,
  actionLabel,
  currentUserId,
  onConfirmed,
  onCancel,
}: AccessCodeConfirmModalProps) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const permission = getPermissionByCode(permissionCode);
  const permissionLabel = permission?.label ?? permissionCode;

  // Focus the input when the modal opens (DOM side-effect only — no setState here).
  // State is reset on cancel and after a successful confirm instead.
  useEffect(() => {
    if (opened) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [opened]);

  const handleCancel = useCallback(() => {
    if (isLoading) return;
    setAccessCode('');
    setError(null);
    onCancel();
  }, [isLoading, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter your access code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.VERIFY_ACCESS_CODE, {
        accessCode: accessCode.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Invalid access code');
        setAccessCode('');
        inputRef.current?.focus();
        setIsLoading(false);
        return;
      }

      const permissions = result.data.permissions as Record<string, boolean> | null;
      const isAdmin = permissions?.ADMIN === true;
      const hasRequired = !!permissions && permissions[permissionCode] === true;
      // Legacy accounts with no permissions map are treated as full-access admins.
      const isLegacyAdmin = !permissions || Object.keys(permissions).length === 0;

      if (!isAdmin && !hasRequired && !isLegacyAdmin) {
        setError(`This user is not permitted to "${permissionLabel}"`);
        setAccessCode('');
        inputRef.current?.focus();
        setIsLoading(false);
        return;
      }

      await onConfirmed({
        employeeId: result.data.employeeId,
        employeeName: result.data.employeeName,
        isCurrentUser: currentUserId != null && result.data.employeeId === currentUserId,
      });
      // Parent closes the modal by clearing the pending request; reset for next open.
      setAccessCode('');
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setAccessCode('');
      inputRef.current?.focus();
      setIsLoading(false);
    }
  }, [accessCode, permissionCode, permissionLabel, currentUserId, onConfirmed]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) handleSubmit();
      else if (e.key === 'Escape') handleCancel();
    },
    [handleSubmit, isLoading, handleCancel]
  );

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={
        <Group gap="xs">
          <IconLock size={20} />
          <Text fw={600}>Confirm with Access Code</Text>
        </Group>
      }
      centered
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape
      // Sits above the modal that triggered it (e.g. Record Payment), which uses
      // Mantine's default modal z-index of 200.
      zIndex={1000}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Enter your access code to complete this action. It affects financial
          records, so the person authorising it is put on record.
        </Text>

        <Group gap="xs">
          <Text size="sm">Requires</Text>
          <Badge color="blue" variant="light" size="sm">
            {permissionLabel}
          </Badge>
        </Group>

        {actionLabel && (
          <Text size="xs" c="dimmed">
            Action: {actionLabel}
          </Text>
        )}

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <PINInput
          ref={inputRef}
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          error={!!error}
          placeholder="Enter Access Code"
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !accessCode.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Confirm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
