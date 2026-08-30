import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader, Textarea, Badge } from '@mantine/core';
import { IconAlertTriangle, IconShieldLock } from '@tabler/icons-react';
import { PINInput } from '../components/auth/PINInput';
import { IpcChannel } from '../../shared/types/ipc';
import { getPermissionByCode } from '../../shared/constants/permissions';

interface RequestAccessModalProps {
  opened: boolean;
  permissionCode: string;
  actionLabel: string;
  onGranted: (grantor: { employeeId: number; employeeName: string }, notes: string) => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Prompts a second, authorised user to enter their access code to grant a
 * one-time override for an action the current user cannot perform.
 *
 * Verification uses VERIFY_ACCESS_CODE, which returns the grantor's identity and
 * permissions WITHOUT switching the logged-in session — the session stays with
 * the original user throughout.
 */
export function RequestAccessModal({
  opened,
  permissionCode,
  actionLabel,
  onGranted,
  onCancel,
}: RequestAccessModalProps) {
  const [accessCode, setAccessCode] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const permission = getPermissionByCode(permissionCode);
  const permissionLabel = permission?.label ?? permissionCode;

  // Focus the input when the modal opens (DOM side-effect only — no setState here).
  useEffect(() => {
    if (opened) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [opened]);

  const resetForm = useCallback(() => {
    setAccessCode('');
    setNotes('');
    setError(null);
    setIsLoading(false);
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [resetForm, onCancel]);

  const handleSubmit = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter an access code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.VERIFY_ACCESS_CODE, {
        accessCode: accessCode.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Verification failed');
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
        setError(`This user cannot authorise "${permissionLabel}"`);
        setAccessCode('');
        inputRef.current?.focus();
        setIsLoading(false);
        return;
      }

      await onGranted(
        { employeeId: result.data.employeeId, employeeName: result.data.employeeName },
        notes.trim()
      );
      // Parent closes the modal by clearing the pending request; reset for next open.
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setAccessCode('');
      inputRef.current?.focus();
      setIsLoading(false);
    }
  }, [accessCode, notes, onGranted, permissionCode, permissionLabel, resetForm]);

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
          <IconShieldLock size={20} color="var(--mantine-color-orange-6)" />
          <Text fw={600}>Authorisation Required</Text>
        </Group>
      }
      centered
      size="md"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          <Text size="sm" fw={500} mb={4}>
            You don&apos;t have permission for this action.
          </Text>
          <Group gap="xs">
            <Text size="sm">Requires</Text>
            <Badge color="orange" variant="light" size="sm">
              {permissionLabel}
            </Badge>
          </Group>
          {actionLabel && (
            <Text size="xs" c="dimmed" mt={4}>
              Action: {actionLabel}
            </Text>
          )}
        </Alert>

        <Text size="sm" c="dimmed">
          An authorised user can enter their access code to approve this one action.
          The session stays signed in as the current user.
        </Text>

        {error && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
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
          placeholder="Authoriser Access Code"
        />

        <Textarea
          label="Reason (optional)"
          placeholder="Reason for authorising this action..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          disabled={isLoading}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button color="orange" onClick={handleSubmit} disabled={isLoading || !accessCode.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Authorise'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
