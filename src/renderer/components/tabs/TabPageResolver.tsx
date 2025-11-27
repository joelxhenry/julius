import { useMemo } from 'react';
import { TabContextProvider } from '../../contexts/TabContext';

// Import all page components
import { DashboardPage } from '../../pages/dashboard/DashboardPage';
import { ClientsListPage } from '../../pages/clients/ClientsListPage';
import { ClientDetailPage } from '../../pages/clients/ClientDetailPage';
import { PartsListPage } from '../../pages/inventory/PartsListPage';
import { PartDetailPage } from '../../pages/inventory/PartDetailPage';
import { InvoicesListPage } from '../../pages/invoices/InvoicesListPage';
import { InvoiceEditorPage } from '../../pages/invoices/InvoiceEditorPage';
import { QuotationsListPage } from '../../pages/quotations/QuotationsListPage';
import { QuotationEditorPage } from '../../pages/quotations/QuotationEditorPage';
import { PaymentsListPage } from '../../pages/payments/PaymentsListPage';
import { CreditNotesPage } from '../../pages/credit-notes/CreditNotesPage';
import { UsersListPage } from '../../pages/users/UsersListPage';
import { UserDetailPage } from '../../pages/users/UserDetailPage';
import { SettingsPage } from '../../pages/settings/SettingsPage';

interface TabPageResolverProps {
  path: string;
  tabId: string;
}

// Extract ID from path for detail/editor pages
function extractIdFromPath(path: string): string | undefined {
  const match = path.match(/\/([^/]+)$/);
  return match?.[1];
}

// Create a fake params object to pass to pages that expect useParams
function createParamsProvider(params: Record<string, string>) {
  // We'll need to modify pages to accept params as props instead of using useParams
  return params;
}

export function TabPageResolver({ path, tabId }: TabPageResolverProps) {
  const { Component, props } = useMemo(() => {
    // Dashboard
    if (path === '/') {
      return { Component: DashboardPage, props: {} };
    }

    // Invoices
    if (path === '/invoices') {
      return { Component: InvoicesListPage, props: {} };
    }
    if (path.startsWith('/invoices/')) {
      const id = extractIdFromPath(path);
      return { Component: InvoiceEditorPage, props: { id } };
    }

    // Quotations
    if (path === '/quotations') {
      return { Component: QuotationsListPage, props: {} };
    }
    if (path.startsWith('/quotations/')) {
      const id = extractIdFromPath(path);
      return { Component: QuotationEditorPage, props: { id } };
    }

    // Clients
    if (path === '/clients') {
      return { Component: ClientsListPage, props: {} };
    }
    if (path.startsWith('/clients/')) {
      const id = extractIdFromPath(path);
      return { Component: ClientDetailPage, props: { id } };
    }

    // Parts/Inventory
    if (path === '/inventory/parts') {
      return { Component: PartsListPage, props: {} };
    }
    if (path.startsWith('/inventory/parts/')) {
      const id = extractIdFromPath(path);
      return { Component: PartDetailPage, props: { id } };
    }

    // Payments
    if (path === '/payments') {
      return { Component: PaymentsListPage, props: {} };
    }

    // Credit Notes
    if (path === '/credit-notes') {
      return { Component: CreditNotesPage, props: {} };
    }

    // Users
    if (path === '/users') {
      return { Component: UsersListPage, props: {} };
    }
    if (path.startsWith('/users/')) {
      const id = extractIdFromPath(path);
      return { Component: UserDetailPage, props: { id } };
    }

    // Settings
    if (path === '/settings') {
      return { Component: SettingsPage, props: {} };
    }

    // Fallback to Dashboard
    return { Component: DashboardPage, props: {} };
  }, [path]);

  return (
    <TabContextProvider tabId={tabId}>
      <Component {...props} />
    </TabContextProvider>
  );
}
