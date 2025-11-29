import { Container, Title, Text, Button, Stack, Group, Paper, Code, ThemeIcon } from '@mantine/core';
import { IconAlertCircle, IconHome, IconRefresh } from '@tabler/icons-react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';

export function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    navigate('/');
  };

  let errorTitle = 'Something went wrong';
  let errorMessage = 'An unexpected error occurred. Please try again.';
  let errorDetails: string | null = null;

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
    errorDetails = error.data?.message || null;
  } else if (error instanceof Error) {
    errorDetails = error.message;
  }

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

        {errorDetails && (
          <Paper withBorder p="md" bg="red.0" w="100%" maw={500}>
            <Text size="sm" fw={600} mb="xs" c="red.8">
              Error Details:
            </Text>
            <Code block c="red.7">
              {errorDetails}
            </Code>
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
