import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { PINInput } from './PINInput';
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
  title = 'Enter Access Code',
  description = 'Enter your access code to continue',
}: PinVerificationModalProps) {
  const { verifyPin, hasPermission, isSessionValid, user, refreshActivity } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear state when modal opens/closes
  useEffect(() => {
    if (opened) {
      setPin('');
      setError(null);
      // Focus input after a short delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [opened]);

  // Check if user is already authenticated with valid session
  useEffect(() => {
    if (opened && user && isSessionValid) {
      // User has valid session, check permission
      if (!requiredPermission || hasPermission(requiredPermission)) {
        refreshActivity();
        onVerified(user);
        onClose();
      }
    }
  }, [opened, user, isSessionValid, requiredPermission, hasPermission, refreshActivity, onVerified, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!pin.trim()) {
      setError('Please enter your access code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const employee = await verifyPin(pin);

      // Check permission if required
      if (requiredPermission) {
        const permissions = employee.permissions as Record<string, boolean> | null;
        const hasAccess = permissions?.['ADMIN'] === true || permissions?.[requiredPermission] === true || !permissions || Object.keys(permissions).length === 0;

        if (!hasAccess) {
          setError('You do not have permission for this action');
          setPin('');
          setIsLoading(false);
          return;
        }
      }

      onVerified(employee);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid access code');
      setPin('');
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [pin, verifyPin, requiredPermission, onVerified, onClose]);

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

        <PINInput
          ref={inputRef}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          error={!!error}
          placeholder='Enter Access Code'
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !pin.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Verify'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
