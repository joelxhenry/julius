import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useTabManager } from '../../contexts/TabManagerContext';

interface GlobalKeyboardShortcutsProps {
  onOpenSpotlight?: () => void;
}

export function GlobalKeyboardShortcuts({
  onOpenSpotlight,
}: GlobalKeyboardShortcutsProps) {
  const { openTab, closeTab, nextTab, prevTab, activeTabId, getActiveTab } = useTabManager();

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
        openTab({
          type: 'invoice-editor',
          path: '/invoices/new',
          title: 'New Invoice',
          entityId: 'new',
        });
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
        openTab({
          type: 'clients-list',
          path: '/clients',
          title: 'Clients',
          entityId: null,
        });
        notifications.show({
          title: 'Clients',
          message: 'Opening clients list...',
          color: 'blue',
          autoClose: 2000,
        });
      },
    ],
  ]);

  // F5 - Parts Inventory (override browser refresh)
  useHotkeys([
    [
      'F5',
      (e) => {
        e.preventDefault();
        openTab({
          type: 'parts-list',
          path: '/inventory/parts',
          title: 'Parts',
          entityId: null,
        });
        notifications.show({
          title: 'Parts Inventory',
          message: 'Opening parts inventory...',
          color: 'blue',
          autoClose: 2000,
        });
      },
    ],
  ]);

  // Ctrl+W - Close current tab
  useHotkeys([
    [
      'mod+W',
      (e) => {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      },
    ],
  ]);

  // Ctrl+Tab - Next tab
  useHotkeys([
    [
      'mod+Tab',
      (e) => {
        e.preventDefault();
        nextTab();
      },
    ],
  ]);

  // Ctrl+Shift+Tab - Previous tab
  useHotkeys([
    [
      'mod+shift+Tab',
      (e) => {
        e.preventDefault();
        prevTab();
      },
    ],
  ]);

  // Ctrl+S - Save (context-aware)
  useHotkeys([
    [
      'mod+S',
      (e) => {
        e.preventDefault();
        const activeTab = getActiveTab();
        const path = activeTab?.path || '';

        // Check if we're on an editor page
        if (path.includes('/invoices/') ||
            path.includes('/quotations/') ||
            path.includes('/clients/') ||
            path.includes('/users/') ||
            path.includes('/inventory/parts/')) {

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
        const activeTab = getActiveTab();
        const path = activeTab?.path || '';

        // Check if we're on a printable page
        if (path.includes('/invoices/') ||
            path.includes('/quotations/')) {

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
