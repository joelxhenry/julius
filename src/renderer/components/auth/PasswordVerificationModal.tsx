import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader, TextInput, PasswordInput } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { SafeEmployee } from '../../contexts/AuthContext';
import { IpcChannel } from '../../../shared/types/ipc';

interface PasswordVerificationModalProps {
  opened: boolean;
  onClose: () => void;
  onVerified: (employee: SafeEmployee) => void;
  title?: string;
  description?: string;
}

export function PasswordVerificationModal({
  opened,
  onClose,
  onVerified,
  title = 'Authentication Required',
  description = 'Enter your username and password to continue',
}: PasswordVerificationModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  // Clear state when modal opens/closes
  useEffect(() => {
    if (opened) {
      setUsername('');
      setPassword('');
      setError(null);
      // Focus username input after a short delay to ensure modal is rendered
      setTimeout(() => {
        usernameRef.current?.focus();
      }, 100);
    }
  }, [opened]);

  const handleSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.AUTHENTICATE_EMPLOYEE, { username, password });

      if (result.success && result.data?.employee) {
        onVerified(result.data.employee);
        onClose();
      } else {
        setError(result.error || 'Authentication failed');
        setPassword('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid username or password');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  }, [username, password, onVerified, onClose]);

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

        <TextInput
          ref={usernameRef}
          label="Username"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoComplete="username"
        />

        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoComplete="current-password"
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !username.trim() || !password.trim()}>
            {isLoading ? <Loader size="xs" color="white" /> : 'Sign In'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
