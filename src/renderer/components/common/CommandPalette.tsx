import { Spotlight, SpotlightActionData } from '@mantine/spotlight';
import { useNavigate } from 'react-router-dom';
import {
  IconFileInvoice,
  IconUsers,
  IconPackage,
  IconFileDescription,
  IconCash,
  IconReceipt,
  IconUserCircle,
  IconSettings,
  IconHome,
  IconSearch,
} from '@tabler/icons-react';

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
}

export function CommandPalette({ opened, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();

  const actions: SpotlightActionData[] = [
    // Navigation
    {
      id: 'dashboard',
      label: 'Dashboard',
      description: 'Go to dashboard',
      onClick: () => {
        navigate('/');
        onClose();
      },
      leftSection: <IconHome size={20} />,
    },

    // Invoices
    {
      id: 'invoices',
      label: 'Invoices',
      description: 'View all invoices',
      onClick: () => {
        navigate('/invoices');
        onClose();
      },
      leftSection: <IconFileInvoice size={20} />,
    },
    {
      id: 'new-invoice',
      label: 'New Invoice',
      description: 'Create a new invoice',
      onClick: () => {
        navigate('/invoices/new');
        onClose();
      },
      leftSection: <IconFileInvoice size={20} />,
      keywords: ['create', 'add'],
    },

    // Quotations
    {
      id: 'quotations',
      label: 'Quotations',
      description: 'View all quotations',
      onClick: () => {
        navigate('/quotations');
        onClose();
      },
      leftSection: <IconFileDescription size={20} />,
    },
    {
      id: 'new-quotation',
      label: 'New Quotation',
      description: 'Create a new quotation',
      onClick: () => {
        navigate('/quotations/new');
        onClose();
      },
      leftSection: <IconFileDescription size={20} />,
      keywords: ['create', 'add', 'quote'],
    },

    // Clients
    {
      id: 'clients',
      label: 'Clients',
      description: 'View all clients',
      onClick: () => {
        navigate('/clients');
        onClose();
      },
      leftSection: <IconUsers size={20} />,
    },

    // Inventory
    {
      id: 'parts',
      label: 'Parts Inventory',
      description: 'View parts inventory',
      onClick: () => {
        navigate('/inventory/parts');
        onClose();
      },
      leftSection: <IconPackage size={20} />,
      keywords: ['stock', 'products'],
    },

    // Payments
    {
      id: 'payments',
      label: 'Payments',
      description: 'View all payments',
      onClick: () => {
        navigate('/payments');
        onClose();
      },
      leftSection: <IconCash size={20} />,
    },

    // Credit Notes
    {
      id: 'credit-notes',
      label: 'Credit Notes',
      description: 'View all credit notes',
      onClick: () => {
        navigate('/credit-notes');
        onClose();
      },
      leftSection: <IconReceipt size={20} />,
    },

    // Employees
    {
      id: 'employees',
      label: 'Employees',
      description: 'Manage employees',
      onClick: () => {
        navigate('/employees');
        onClose();
      },
      leftSection: <IconUserCircle size={20} />,
    },

    // Settings
    {
      id: 'settings',
      label: 'Settings',
      description: 'Application settings',
      onClick: () => {
        navigate('/settings');
        onClose();
      },
      leftSection: <IconSettings size={20} />,
    },
  ];

  return (
    <Spotlight
      actions={actions}
      nothingFound="No results found"
      highlightQuery
      searchProps={{
        leftSection: <IconSearch size={20} />,
        placeholder: 'Search or jump to...',
      }}
      shortcut={['mod + K', 'F2']}
      opened={opened}
      onClose={onClose}
    />
  );
}
