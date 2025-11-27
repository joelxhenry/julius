import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './renderer/styles/globals.css';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/spotlight/styles.css';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { AuthProvider } from './renderer/contexts/AuthContext';
import { TabManagerProvider } from './renderer/contexts/TabManagerContext';
import { router } from './renderer/router';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <MantineProvider>
      <Notifications position="top-right" />
      <AuthProvider>
        <TabManagerProvider>
          <RouterProvider router={router} />
        </TabManagerProvider>
      </AuthProvider>
    </MantineProvider>
  </React.StrictMode>
);
