import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Title, TextInput, Button, Stack, Alert, Center, Box } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { PINInput } from '../../components/auth/PINInput';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'username' | 'pin'>('username');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setStep('pin');
      setError('');
    }
  };

  const handlePINComplete = async (value: string) => {
    setPin(value);
    setError('');
    setIsLoading(true);

    try {
      await login(username, value);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setPin('');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('username');
    setPin('');
    setError('');
  };

  return (
    <Box className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Center className="min-h-screen">
        <Container size={420}>
          <Paper withBorder shadow="lg" p={30} radius="md">
            <Title order={2} ta="center" mb="md">
              Turbo Julius
            </Title>
            <Title order={4} ta="center" mb="xl" c="dimmed">
              Auto Parts Management
            </Title>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
                {error}
              </Alert>
            )}

            {step === 'username' ? (
              <form onSubmit={handleUsernameSubmit}>
                <Stack>
                  <TextInput
                    label="Username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    size="md"
                  />
                  <Button type="submit" fullWidth size="md" disabled={!username.trim()}>
                    Continue
                  </Button>
                </Stack>
              </form>
            ) : (
              <Stack>
                <div>
                  <Title order={6} mb="xs" c="dimmed">
                    Welcome, {username}
                  </Title>
                  <Title order={5} mb="md">
                    Enter your PIN
                  </Title>
                </div>

                <Center>
                  <PINInput
                    value={pin}
                    onChange={setPin}
                    onComplete={handlePINComplete}
                    disabled={isLoading}
                    autoFocus
                  />
                </Center>

                <Button variant="subtle" onClick={handleBack} disabled={isLoading}>
                  Back
                </Button>
              </Stack>
            )}
          </Paper>
        </Container>
      </Center>
    </Box>
  );
}
