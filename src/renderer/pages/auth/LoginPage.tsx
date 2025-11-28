import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Title, TextInput, PasswordInput, Button, Stack, Alert, Center, Box, Text } from '@mantine/core';
import { IconAlertCircle, IconUser, IconLock } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setPassword('');
      setIsLoading(false);
    }
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

            <form onSubmit={handleSubmit}>
              <Stack>
                <TextInput
                  label="Username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  size="md"
                  leftSection={<IconUser size={16} />}
                />
                <PasswordInput
                  label="Password / PIN"
                  placeholder="Enter your password or PIN"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  size="md"
                  leftSection={<IconLock size={16} />}
                />
                <Button
                  type="submit"
                  fullWidth
                  size="md"
                  loading={isLoading}
                  disabled={!username.trim() || !password.trim()}
                >
                  Sign In
                </Button>
              </Stack>
            </form>

            <Text size="xs" c="dimmed" ta="center" mt="lg">
              Default: admin / 0609
            </Text>
          </Paper>
        </Container>
      </Center>
    </Box>
  );
}
