import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
  Box,
  Text,
  Transition,
  Group,
  Anchor,
} from '@mantine/core';
import { IconAlertCircle, IconUser, IconLock, IconArrowLeft } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';


const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    setError('');
    setShowPinInput(true);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);
    setPin(value);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (pin.length < MIN_PIN_LENGTH) {
      setError(`PIN must be at least ${MIN_PIN_LENGTH} digits`);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(username, pin);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setPin('');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setShowPinInput(false);
    setPin('');
    setError('');
  };

  const isValidPin = pin.length >= MIN_PIN_LENGTH && pin.length <= MAX_PIN_LENGTH;

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-indigo-9) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mantine-spacing-xl)',
      }}
    >
      <Box
        style={{
          width: '100%',
          maxWidth: 480,
        }}
      >
        {/* Logo/Brand Section */}
        <Stack align="center" mb="xl">
          <ThemeIcon
            size={80}
            radius="xl"
            variant="white"
            color="blue"
          >
            <IconEngine size={48} stroke={1.5} />
          </ThemeIcon>
          <Text size="2rem" fw={700} c="white" ta="center">
            Turbo Julius
          </Text>
          <Text size="md" c="rgba(255,255,255,0.8)" ta="center">
            Auto Parts Management System
          </Text>
        </Stack>

        {/* Form Section */}
        <Box
          p="xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 'var(--mantine-radius-lg)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {error && (
            <Alert
              icon={<IconAlertCircle size={18} />}
              color="red"
              variant="filled"
              radius="md"
              mb="lg"
            >
              {error}
            </Alert>
          )}

          {/* Username Input Section */}
          <Transition
            mounted={!showPinInput}
            transition="fade"
            duration={200}
          >
            {(styles) => (
              <form onSubmit={handleUsernameSubmit} style={styles}>
                <Stack gap="lg">
                  <TextInput
                    label={<Text component="span" c="white" fw={500}>Username</Text>}
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    size="lg"
                    radius="md"
                    leftSection={<IconUser size={20} />}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        '&:focus': {
                          backgroundColor: 'white',
                        },
                      },
                    }}
                  />
                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    radius="md"
                    disabled={!username.trim()}
                    color="white"
                    variant="filled"
                    styles={{
                      root: {
                        backgroundColor: 'white',
                        color: 'var(--mantine-color-blue-7)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.9)',
                        },
                        '&:disabled': {
                          backgroundColor: 'rgba(255,255,255,0.5)',
                          color: 'rgba(0,0,0,0.4)',
                        },
                      },
                    }}
                  >
                    Continue
                  </Button>
                </Stack>
              </form>
            )}
          </Transition>

          {/* PIN Input Section */}
          <Transition
            mounted={showPinInput}
            transition="fade"
            duration={200}
          >
            {(styles) => (
              <form onSubmit={handleLogin} style={styles}>
                <Stack gap="lg">
                  <Group gap="xs">
                    <Anchor
                      component="button"
                      type="button"
                      onClick={handleBack}
                      c="white"
                      size="sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <IconArrowLeft size={14} />
                      Back
                    </Anchor>
                  </Group>

                  <Box ta="center" py="sm">
                    <Text size="sm" c="rgba(255,255,255,0.7)" mb={4}>
                      Welcome back,
                    </Text>
                    <Text size="xl" fw={700} c="white">
                      {username}
                    </Text>
                  </Box>

                  <PasswordInput
                    label={<Text component="span" c="white" fw={500}>PIN</Text>}
                    description={<Text component="span" size="xs" c="rgba(255,255,255,0.6)">{MIN_PIN_LENGTH}-{MAX_PIN_LENGTH} digits</Text>}
                    value={pin}
                    onChange={handlePinChange}
                    disabled={isLoading}
                    autoFocus
                    size="lg"
                    radius="md"
                    leftSection={<IconLock size={20} />}
                    inputMode="numeric"
                    maxLength={MAX_PIN_LENGTH}
                    styles={{
                      input: {
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        border: 'none',
                        fontFamily: 'monospace',
                        letterSpacing: '0.5em',
                        fontSize: '1.25rem',
                        textAlign: 'center',
                        '&:focus': {
                          backgroundColor: 'white',
                        },
                      },
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    size="lg"
                    radius="md"
                    loading={isLoading}
                    disabled={!isValidPin}
                    color="white"
                    variant="filled"
                    styles={{
                      root: {
                        backgroundColor: 'white',
                        color: 'var(--mantine-color-blue-7)',
                        '&:hover': {
                          backgroundColor: 'rgba(255,255,255,0.9)',
                        },
                        '&:disabled': {
                          backgroundColor: 'rgba(255,255,255,0.5)',
                          color: 'rgba(0,0,0,0.4)',
                        },
                      },
                    }}
                  >
                    Sign In
                  </Button>
                </Stack>
              </form>
            )}
          </Transition>
        </Box>

        {/* Footer */}
        <Stack align="center" mt="xl" gap="xs">
          <Text size="sm" c="rgba(255,255,255,0.7)" ta="center">
            First time? Use default credentials:
          </Text>
          <Text size="sm" c="white" fw={600} ta="center">
            admin / 0609
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
