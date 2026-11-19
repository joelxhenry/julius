import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader, Badge } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { EmployeeCredentialFields } from './EmployeeCredentialFields';
import { useAuth } from '../../contexts/AuthContext';
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
 * Credential gate for financial actions (create invoice / quotation, record
 * payment). A password is ALWAYS required to complete the action.
 *
 * Verification uses VERIFY_EMPLOYEE_CREDENTIALS, which resolves the employee's
 * identity and effective permissions WITHOUT switching the logged-in session. If
 * the credentials belong to a different, suitably-permissioned user, that user is
 * returned as the actor so the caller can put them "on record" — the session
 * stays signed in as the original user.
 */
export function AccessCodeConfirmModal({
  opened,
  permissionCode,
  actionLabel,
  currentUserId,
  onConfirmed,
  onCancel,
}: AccessCodeConfirmModalProps) {
  const { user } = useAuth();
  const currentUsername = user?.username ?? null;
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const permission = getPermissionByCode(permissionCode);
  const permissionLabel = permission?.label ?? permissionCode;

  // Pre-select the signed-in user on open (they're the common case for "on
  // record" confirmations), and focus the input (DOM side-effect only).
  // State is reset on cancel and after a successful confirm instead.
  useEffect(() => {
    if (opened) {
      setSelectedUsername(currentUsername);
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
    // currentUsername is read once per open; re-running on every session change
    // would clobber an in-progress selection of a different authoriser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleCancel = useCallback(() => {
    if (isLoading) return;
    setSelectedUsername(currentUsername);
    setPassword('');
    setError(null);
    onCancel();
  }, [isLoading, onCancel, currentUsername]);

  const handleSubmit = useCallback(async () => {
    if (!selectedUsername || !password.trim()) {
      setError('Please select your name and enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.VERIFY_EMPLOYEE_CREDENTIALS, {
        username: selectedUsername,
        password,
      });

      if (!result.success) {
        setError(result.error || 'Invalid username or password');
        setPassword('');
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
        setPassword('');
        setIsLoading(false);
        return;
      }

      await onConfirmed({
        employeeId: result.data.employeeId,
        employeeName: result.data.employeeName,
        isCurrentUser: currentUserId != null && result.data.employeeId === currentUserId,
      });
      // Parent closes the modal by clearing the pending request; reset for next open.
      setSelectedUsername(currentUsername);
      setPassword('');
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setPassword('');
      setIsLoading(false);
    }
  }, [selectedUsername, password, permissionCode, permissionLabel, currentUserId, onConfirmed, currentUsername]);

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
          <Text fw={600}>Confirm with Password</Text>
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
          Enter your password to complete this action. It affects financial
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

        <div onKeyDown={handleKeyDown}>
          <EmployeeCredentialFields
            employeeInputRef={inputRef}
            selectedUsername={selectedUsername}
            onSelectUsername={setSelectedUsername}
            initialEmployee={currentUsername ? { username: currentUsername, firstName: user?.firstName ?? null, lastName: user?.lastName ?? null } : null}
            password={password}
            onPasswordChange={setPassword}
            disabled={isLoading}
            error={!!error}
          />
        </div>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedUsername || !password.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Confirm'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
