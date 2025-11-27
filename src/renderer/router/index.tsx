import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ClientsListPage } from '../pages/clients/ClientsListPage';
import { ClientDetailPage } from '../pages/clients/ClientDetailPage';
import { PartsListPage } from '../pages/inventory/PartsListPage';
import { PartDetailPage } from '../pages/inventory/PartDetailPage';
import { InvoicesListPage } from '../pages/invoices/InvoicesListPage';
import { InvoiceEditorPage } from '../pages/invoices/InvoiceEditorPage';
import { QuotationsListPage } from '../pages/quotations/QuotationsListPage';
import { QuotationEditorPage } from '../pages/quotations/QuotationEditorPage';
import { PaymentsListPage } from '../pages/payments/PaymentsListPage';
import { CreditNotesPage } from '../pages/credit-notes/CreditNotesPage';
import { UsersListPage } from '../pages/users/UsersListPage';
import { UserDetailPage } from '../pages/users/UserDetailPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { useAuth } from '../contexts/AuthContext';

// Protected Route wrapper
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          // Clients routes
          {
            path: 'clients',
            element: <ClientsListPage />,
          },
          {
            path: 'clients/:id',
            element: <ClientDetailPage />,
          },
          // Inventory routes
          {
            path: 'inventory/parts',
            element: <PartsListPage />,
          },
          {
            path: 'inventory/parts/:id',
            element: <PartDetailPage />,
          },
          // Invoices routes
          {
            path: 'invoices',
            element: <InvoicesListPage />,
          },
          {
            path: 'invoices/:id',
            element: <InvoiceEditorPage />,
          },
          // Quotations routes
          {
            path: 'quotations',
            element: <QuotationsListPage />,
          },
          {
            path: 'quotations/:id',
            element: <QuotationEditorPage />,
          },
          // Payments routes
          {
            path: 'payments',
            element: <PaymentsListPage />,
          },
          // Credit Notes routes
          {
            path: 'credit-notes',
            element: <CreditNotesPage />,
          },
          // Users routes
          {
            path: 'users',
            element: <UsersListPage />,
          },
          {
            path: 'users/:id',
            element: <UserDetailPage />,
          },
          // Settings route
          {
            path: 'settings',
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);
