import { Container, Title, Text, Button, Stack, Group, ThemeIcon } from '@mantine/core';
import { IconFileSearch, IconHome, IconArrowLeft } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="xl" py="xl">
        <ThemeIcon size={120} radius="xl" variant="light" color="gray">
          <IconFileSearch size={64} />
        </ThemeIcon>

        <Stack align="center" gap="sm">
          <Title order={1} ta="center">
            404
          </Title>
          <Title order={2} ta="center" c="dimmed" fw={400}>
            Page Not Found
          </Title>
        </Stack>

        <Text c="dimmed" ta="center" size="lg" maw={500}>
          The page you are looking for doesn't exist or has been moved.
          Please check the URL or navigate back to the dashboard.
        </Text>

        <Group>
          <Button
            variant="light"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleGoBack}
          >
            Go Back
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
