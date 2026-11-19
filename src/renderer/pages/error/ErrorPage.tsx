import { useEffect } from 'react';
import { Container, Title, Text, Button, Stack, Group, Paper, ThemeIcon } from '@mantine/core';
import { IconAlertCircle, IconHome, IconRefresh } from '@tabler/icons-react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  let errorTitle = 'Something went wrong';
  let errorMessage = 'An unexpected error occurred. Please try again.';
  let technicalDetails: string | null = null;

  if (isRouteErrorResponse(error)) {
    switch (error.status) {
      case 404:
        errorTitle = 'Page Not Found';
        errorMessage = 'The page you are looking for doesn\'t exist or has been moved.';
        break;
      case 401:
        errorTitle = 'Unauthorized';
        errorMessage = 'You don\'t have permission to access this page.';
        break;
      case 403:
        errorTitle = 'Forbidden';
        errorMessage = 'Access to this resource is denied.';
        break;
      case 500:
        errorTitle = 'Server Error';
        errorMessage = 'An internal server error occurred.';
        break;
      default:
        errorTitle = `Error ${error.status}`;
        errorMessage = error.statusText || 'An error occurred.';
    }
    technicalDetails = error.data?.message || null;
  } else if (error instanceof Error) {
    technicalDetails = error.message;
  }

  // Best-effort report to the main process so it lands in the reviewable
  // error log (sanitized server-side; see src/main/services/errorSanitizer.ts).
  useEffect(() => {
    if (!technicalDetails) return;
    window.electron
      .invoke(IpcChannel.LOG_RENDERER_ERROR, {
        message: technicalDetails,
        stack: error instanceof Error ? error.stack : undefined,
        employeeId: user?.id,
        employeeName: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username : undefined,
      })
      .catch(() => { /* logging must never compound the crash */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xl" py="xl">
        <ThemeIcon size={120} radius="xl" variant="light" color="red">
          <IconAlertCircle size={64} />
        </ThemeIcon>

        <Stack align="center" gap="sm">
          <Title order={1} ta="center" c="red.7">
            Oops!
          </Title>
          <Title order={2} ta="center">
            {errorTitle}
          </Title>
        </Stack>

        <Text c="dimmed" ta="center" size="lg" maw={500}>
          {errorMessage}
        </Text>

        {technicalDetails && (
          <Paper withBorder p="md" bg="red.0" w="100%" maw={500}>
            <Text size="sm" c="red.8" ta="center">
              This has been logged for review. If it keeps happening, please contact support.
            </Text>
          </Paper>
        )}

        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={handleReload}
          >
            Try Again
          </Button>
          <Button
            leftSection={<IconHome size={16} />}
            onClick={handleGoHome}
          >
            Go to Dashboard
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
