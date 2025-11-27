import { useHotkeys } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

interface GlobalKeyboardShortcutsProps {
  onOpenSpotlight?: () => void;
}

export function GlobalKeyboardShortcuts({
  onOpenSpotlight,
}: GlobalKeyboardShortcutsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // F2 - Open Command Palette/Spotlight
  useHotkeys([
    [
      'F2',
      () => {
        if (onOpenSpotlight) {
          onOpenSpotlight();
        }
      },
    ],
  ]);

  // F3 - New Invoice
  useHotkeys([
    [
      'F3',
      () => {
        navigate('/invoices/new');
        notifications.show({
          title: 'New Invoice',
          message: 'Creating new invoice...',
          color: 'blue',
          autoClose: 2000,
        });
      },
    ],
  ]);

  // F4 - New Client
  useHotkeys([
    [
      'F4',
      () => {
        navigate('/clients');
        // Would open create modal if on clients page
        notifications.show({
          title: 'New Client',
          message: 'Navigate to clients to create...',
          color: 'blue',
          autoClose: 2000,
        });
      },
    ],
  ]);

  // F5 - New Part (override browser refresh)
  useHotkeys([
    [
      'F5',
      (e) => {
        e.preventDefault();
        navigate('/inventory/parts');
        notifications.show({
          title: 'Parts Inventory',
          message: 'Navigate to parts inventory...',
          color: 'blue',
          autoClose: 2000,
        });
      },
    ],
  ]);

  // Ctrl+S - Save (context-aware)
  useHotkeys([
    [
      'mod+S',
      (e) => {
        e.preventDefault();

        // Check if we're on an editor page
        if (location.pathname.includes('/invoices/') ||
            location.pathname.includes('/quotations/') ||
            location.pathname.includes('/clients/') ||
            location.pathname.includes('/employees/') ||
            location.pathname.includes('/inventory/parts/')) {

          notifications.show({
            title: 'Save',
            message: 'Triggering save action...',
            color: 'green',
            autoClose: 2000,
          });

          // Trigger custom save event that pages can listen to
          window.dispatchEvent(new CustomEvent('global-save'));
        }
      },
    ],
  ]);

  // Ctrl+P - Print (context-aware)
  useHotkeys([
    [
      'mod+P',
      (e) => {
        e.preventDefault();

        // Check if we're on a printable page
        if (location.pathname.includes('/invoices/') ||
            location.pathname.includes('/quotations/')) {

          notifications.show({
            title: 'Print',
            message: 'Opening print dialog...',
            color: 'blue',
            autoClose: 2000,
          });

          // Trigger custom print event that pages can listen to
          window.dispatchEvent(new CustomEvent('global-print'));
        }
      },
    ],
  ]);

  // Escape - Close modals/cancel (handled by Mantine modals automatically)

  return null;
}
