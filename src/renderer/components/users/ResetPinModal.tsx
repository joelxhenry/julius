import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  Alert,
  PinInput,
  Center,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
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

export function ResetPinModal({ opened, onClose, user, onReset }: ResetPinModalProps) {
  const { update } = useUsers();
  const [loading, setLoading] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [useDefaultPin, setUseDefaultPin] = useState(true);

  const handleReset = async () => {
    // Validate PINs if not using default
    if (!useDefaultPin) {
      if (newPin.length !== 4) {
        notifications.show({
          title: 'Invalid PIN',
          message: 'PIN must be 4 digits',
          color: 'red',
        });
        return;
      }
      if (newPin !== confirmPin) {
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
            <div>
              <Text size="sm" fw={500} mb="xs">
                New PIN
              </Text>
              <Center>
                <PinInput
                  length={4}
                  type="number"
                  mask
                  value={newPin}
                  onChange={setNewPin}
                  size="lg"
                />
              </Center>
            </div>
            <div>
              <Text size="sm" fw={500} mb="xs">
                Confirm PIN
              </Text>
              <Center>
                <PinInput
                  length={4}
                  type="number"
                  mask
                  value={confirmPin}
                  onChange={setConfirmPin}
                  size="lg"
                  error={confirmPin.length === 4 && newPin !== confirmPin}
                />
              </Center>
              {confirmPin.length === 4 && newPin !== confirmPin && (
                <Text size="xs" c="red" ta="center" mt="xs">
                  PINs do not match
                </Text>
              )}
            </div>
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
            disabled={!useDefaultPin && (newPin.length !== 4 || newPin !== confirmPin)}
          >
            Reset PIN
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
