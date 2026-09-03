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
import { AccessOverrideProvider } from './renderer/permissions';
import { ThemeProvider, useTheme } from './renderer/contexts/ThemeContext';
import { DatabaseConnectionProvider } from './renderer/contexts/DatabaseConnectionContext';
import { BackgroundActivityProvider } from './renderer/contexts/BackgroundActivityContext';
import { KeyboardShortcutProvider } from './renderer/contexts/KeyboardShortcutContext';
import { MarkedItemsProvider } from './renderer/contexts/MarkedItemsContext';
import { UpdatesProvider } from './renderer/contexts/UpdatesContext';
import { DatabaseConfigModal } from './renderer/components/database/DatabaseConfigModal';
import { ErrorBoundary } from './renderer/components/common/ErrorBoundary';
import { ThemeTransitionOverlay } from './renderer/components/common/ThemeTransitionOverlay';
import { KeyboardShortcutHelp } from './renderer/components/common/KeyboardShortcutHelp';
import { UpdatePrompt } from './renderer/components/common/UpdatePrompt';
import { FirstRunGate } from './renderer/components/setup/FirstRunGate';
import { theme } from './renderer/theme';
import { router } from './renderer/router';

function AppWithTheme() {
  const { colorScheme } = useTheme();

  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme}>
      <ModalsProvider>
      <Notifications position="top-right" />
      <ThemeTransitionOverlay />
      <BackgroundActivityProvider>
      <UpdatesProvider>
      <UpdatePrompt />
      <FirstRunGate>
        <DatabaseConnectionProvider>
          <DatabaseConfigModal />
          <AuthProvider>
            <AccessOverrideProvider>
              <KeyboardShortcutProvider>
                <KeyboardShortcutHelp />
                <MarkedItemsProvider>
                  <RouterProvider router={router} />
                </MarkedItemsProvider>
              </KeyboardShortcutProvider>
            </AccessOverrideProvider>
          </AuthProvider>
        </DatabaseConnectionProvider>
      </FirstRunGate>
      </UpdatesProvider>
      </BackgroundActivityProvider>
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
