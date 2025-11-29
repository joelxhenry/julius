import { Component, ErrorInfo, ReactNode } from 'react';
import { Container, Title, Text, Button, Stack, Paper, Code, Group } from '@mantine/core';
import { IconAlertTriangle, IconRefresh, IconHome } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" py="xl">
          <Paper withBorder p="xl" radius="md">
            <Stack align="center" gap="lg">
              <IconAlertTriangle size={64} color="var(--mantine-color-red-6)" />

              <Title order={2} ta="center">
                Something went wrong
              </Title>

              <Text c="dimmed" ta="center" size="lg">
                An unexpected error occurred. Please try refreshing the page or return to the dashboard.
              </Text>

              {this.state.error && (
                <Paper withBorder p="md" bg="red.0" w="100%">
                  <Text size="sm" fw={600} mb="xs" c="red.8">
                    Error Details:
                  </Text>
                  <Code block c="red.7">
                    {this.state.error.message}
                  </Code>
                </Paper>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <Paper withBorder p="md" bg="gray.0" w="100%" style={{ maxHeight: 200, overflow: 'auto' }}>
                  <Text size="sm" fw={600} mb="xs">
                    Component Stack:
                  </Text>
                  <Code block size="xs">
                    {this.state.errorInfo.componentStack}
                  </Code>
                </Paper>
              )}

              <Group>
                <Button
                  variant="light"
                  leftSection={<IconRefresh size={16} />}
                  onClick={this.handleReload}
                >
                  Refresh Page
                </Button>
                <Button
                  leftSection={<IconHome size={16} />}
                  onClick={this.handleGoHome}
                >
                  Go to Dashboard
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}
