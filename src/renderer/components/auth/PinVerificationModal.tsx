import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { EmployeeCredentialFields } from './EmployeeCredentialFields';
import { useAuth, SafeEmployee } from '../../contexts/AuthContext';

interface PinVerificationModalProps {
  opened: boolean;
  onClose: () => void;
  onVerified: (employee: SafeEmployee) => void;
  requiredPermission?: string;
  title?: string;
  description?: string;
}

export function PinVerificationModal({
  opened,
  onClose,
  onVerified,
  requiredPermission,
  title = 'Sign In Required',
  description = 'Search for your name and enter your password to continue',
}: PinVerificationModalProps) {
  const { verifyCredentials, hasPermission, isSessionValid, user, refreshActivity } = useAuth();
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear state when modal opens/closes
  useEffect(() => {
    if (opened) {
      setSelectedUsername(null);
      setPassword('');
      setError(null);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [opened]);

  // Check if user is already authenticated with valid session.
  // Guarded by `!isLoading`: handleSubmit's verifyCredentials() call updates `user`/
  // `isSessionValid` partway through (before its own onVerified call), which
  // would otherwise re-run this effect and fire onVerified a second time
  // while the manual submission is still in flight.
  useEffect(() => {
    if (opened && user && isSessionValid && !isLoading) {
      // User has valid session, check permission
      if (!requiredPermission || hasPermission(requiredPermission)) {
        refreshActivity();
        onVerified(user);
      }
    }
  }, [opened, user, isSessionValid, isLoading, requiredPermission, hasPermission, refreshActivity, onVerified]);

  const handleSubmit = useCallback(async () => {
    if (!selectedUsername || !password.trim()) {
      setError('Please select your name and enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const employee = await verifyCredentials(selectedUsername, password);

      // Check permission if required
      if (requiredPermission) {
        const permissions = employee.permissions as Record<string, boolean> | null;
        const hasAccess = permissions?.['ADMIN'] === true || permissions?.[requiredPermission] === true || !permissions || Object.keys(permissions).length === 0;

        if (!hasAccess) {
          setError('You do not have permission for this action');
          setPassword('');
          setIsLoading(false);
          return;
        }
      }

      // Don't call onClose() here - every caller already closes the modal inside
      // onVerified. Calling both fires the parent's cancel/close logic (e.g.
      // AppLayout navigating back to the previous path) against a stale
      // pendingNavigation, since that state hasn't re-rendered yet.
      onVerified(employee);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  }, [selectedUsername, password, verifyCredentials, requiredPermission, onVerified]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, isLoading, onClose]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconLock size={20} />
          <Text fw={600}>{title}</Text>
        </Group>
      }
      centered
      size="sm"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {description}
        </Text>

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
            password={password}
            onPasswordChange={setPassword}
            disabled={isLoading}
            error={!!error}
          />
        </div>

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !selectedUsername || !password.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Verify'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
