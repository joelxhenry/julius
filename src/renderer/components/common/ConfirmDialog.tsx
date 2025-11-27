import { Modal, Stack, Text, Button, Group } from '@mantine/core';
import { useState } from 'react';
import { PINInput } from '../auth/PINInput';
import { useAuth } from '../../contexts/AuthContext';

interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  requirePIN?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
}

export function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  requirePIN = false,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'blue',
}: ConfirmDialogProps) {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { verifyPIN } = useAuth();

  const handleConfirm = async () => {
    if (requirePIN) {
      if (pin.length < 4) {
        setError('Please enter your PIN');
        return;
      }

      const isValid = await verifyPIN(pin);
      if (!isValid) {
        setError('Invalid PIN');
        setPin('');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      await onConfirm();
      setPin('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title={title}>
      <Stack>
        <Text>{message}</Text>

        {requirePIN && (
          <div>
            <Text size="sm" fw={500} mb="xs">
              Enter your PIN to confirm
            </Text>
            <PINInput
              value={pin}
              onChange={setPin}
              onComplete={(value) => setPin(value)}
              error={!!error}
            />
            {error && (
              <Text size="sm" c="red" mt="xs">
                {error}
              </Text>
            )}
          </div>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            color={confirmColor}
            onClick={handleConfirm}
            loading={isLoading}
            disabled={requirePIN && pin.length < 4}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
