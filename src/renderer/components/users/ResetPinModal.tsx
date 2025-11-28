import { useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Alert,
  PasswordInput,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconLock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useUsers } from '../../hooks';
import type { User } from '../../../main/database/schema';

interface ResetPinModalProps {
  opened: boolean;
  onClose: () => void;
  user: User;
  onReset?: () => void;
}

const DEFAULT_PIN = '0000';
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export function ResetPinModal({ opened, onClose, user, onReset }: ResetPinModalProps) {
  const { update } = useUsers();
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [useDefaultPin, setUseDefaultPin] = useState(true);

  const handlePinChange = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
    setter(value);
  };

  const isValidPin = newPin.length >= MIN_PIN_LENGTH && newPin.length <= MAX_PIN_LENGTH;
  const pinsMatch = newPin === confirmPin;

  const handleReset = async () => {
    // Validate PINs if not using default
    if (!useDefaultPin) {
      if (!isValidPin) {
        notifications.show({
          title: 'Invalid PIN',
          message: `PIN must be ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`,
          color: 'red',
        });
        return;
      }
      if (!pinsMatch) {
        notifications.show({
          title: 'PIN Mismatch',
          message: 'PINs do not match',
          color: 'red',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const pinToSet = useDefaultPin ? DEFAULT_PIN : newPin;

      // Update user with new PIN hash and mark as using default if applicable
      await update(user.id, {
        pinHash: pinToSet, // Backend should hash this
        usingDefaultPin: useDefaultPin,
      });

      notifications.show({
        title: 'PIN Reset',
        message: useDefaultPin
          ? `PIN has been reset to default (${DEFAULT_PIN}) for ${user.firstName} ${user.lastName}`
          : `New PIN has been set for ${user.firstName} ${user.lastName}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      onReset?.();
      handleClose();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to reset PIN',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewPin('');
    setConfirmPin('');
    setUseDefaultPin(true);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`Reset PIN for ${user.firstName} ${user.lastName}`}
      size="sm"
      centered
    >
      <Stack>
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="orange"
          variant="light"
        >
          This will reset the user's PIN. They will need to use the new PIN to log in.
        </Alert>

        <Stack gap="xs">
          <Button
            variant={useDefaultPin ? 'filled' : 'light'}
            onClick={() => setUseDefaultPin(true)}
            fullWidth
          >
            Reset to Default PIN ({DEFAULT_PIN})
          </Button>
          <Button
            variant={!useDefaultPin ? 'filled' : 'light'}
            onClick={() => setUseDefaultPin(false)}
            fullWidth
          >
            Set Custom PIN
          </Button>
        </Stack>

        {!useDefaultPin && (
          <Stack gap="md" mt="md">
            <PasswordInput
              label="New PIN"
              description={`${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits`}
              placeholder="Enter new PIN"
              value={newPin}
              onChange={handlePinChange(setNewPin)}
              leftSection={<IconLock size={16} />}
              inputMode="numeric"
              maxLength={MAX_PIN_LENGTH}
              styles={{
                input: {
                  fontFamily: 'monospace',
                  letterSpacing: '0.3em',
                },
              }}
            />
            <PasswordInput
              label="Confirm PIN"
              placeholder="Confirm new PIN"
              value={confirmPin}
              onChange={handlePinChange(setConfirmPin)}
              leftSection={<IconLock size={16} />}
              inputMode="numeric"
              maxLength={MAX_PIN_LENGTH}
              error={confirmPin.length >= MIN_PIN_LENGTH && !pinsMatch ? 'PINs do not match' : undefined}
              styles={{
                input: {
                  fontFamily: 'monospace',
                  letterSpacing: '0.3em',
                },
              }}
            />
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color="orange"
            onClick={handleReset}
            loading={loading}
            disabled={!useDefaultPin && (!isValidPin || !pinsMatch)}
          >
            Reset PIN
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
