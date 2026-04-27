import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './renderer/styles/globals.css';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { AuthProvider } from './renderer/contexts/AuthContext';
import { ThemeProvider, useTheme } from './renderer/contexts/ThemeContext';
import { DatabaseConnectionProvider } from './renderer/contexts/DatabaseConnectionContext';
import { KeyboardShortcutProvider } from './renderer/contexts/KeyboardShortcutContext';
import { MarkedItemsProvider } from './renderer/contexts/MarkedItemsContext';
import { DatabaseConfigModal } from './renderer/components/database/DatabaseConfigModal';
import { ErrorBoundary } from './renderer/components/common/ErrorBoundary';
import { ThemeTransitionOverlay } from './renderer/components/common/ThemeTransitionOverlay';
import { KeyboardShortcutHelp } from './renderer/components/common/KeyboardShortcutHelp';
import { theme } from './renderer/theme';
import { router } from './renderer/router';

function AppWithTheme() {
  const { colorScheme } = useTheme();

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <ModalsProvider>
      <Notifications position="top-right" />
      <ThemeTransitionOverlay />
      <DatabaseConnectionProvider>
        <DatabaseConfigModal />
        <AuthProvider>
          <KeyboardShortcutProvider>
            <KeyboardShortcutHelp />
            <MarkedItemsProvider>
              <RouterProvider router={router} />
            </MarkedItemsProvider>
          </KeyboardShortcutProvider>
        </AuthProvider>
      </DatabaseConnectionProvider>
      </ModalsProvider>
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
