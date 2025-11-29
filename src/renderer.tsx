import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './renderer/styles/globals.css';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './renderer/contexts/AuthContext';
import { TabManagerProvider } from './renderer/contexts/TabManagerContext';
import { ThemeProvider, useTheme } from './renderer/contexts/ThemeContext';
import { DatabaseConnectionProvider } from './renderer/contexts/DatabaseConnectionContext';
import { DatabaseConfigModal } from './renderer/components/database/DatabaseConfigModal';
import { ErrorBoundary } from './renderer/components/common/ErrorBoundary';
import { theme } from './renderer/theme';
import { router } from './renderer/router';

function AppWithTheme() {
  const { colorScheme } = useTheme();

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <Notifications position="top-right" />
      <DatabaseConnectionProvider>
        <DatabaseConfigModal />
        <AuthProvider>
          <TabManagerProvider>
            <RouterProvider router={router} />
          </TabManagerProvider>
        </AuthProvider>
      </DatabaseConnectionProvider>
    </MantineProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppWithTheme />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
