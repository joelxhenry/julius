import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { ClientsListPage } from '../pages/clients/ClientsListPage';
import { ClientDetailPage } from '../pages/clients/ClientDetailPage';
import { PartsListPage } from '../pages/inventory/PartsListPage';
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

// Placeholder pages for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <p>This page will be implemented in Phase 3</p>
    </div>
  );
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
          // Placeholder routes for Phase 3
          {
            path: 'invoices',
            element: <PlaceholderPage title="Invoices" />,
          },
          {
            path: 'quotations',
            element: <PlaceholderPage title="Quotations" />,
          },
          {
            path: 'payments',
            element: <PlaceholderPage title="Payments" />,
          },
          {
            path: 'credit-notes',
            element: <PlaceholderPage title="Credit Notes" />,
          },
          {
            path: 'employees',
            element: <PlaceholderPage title="Employees" />,
          },
          {
            path: 'settings',
            element: <PlaceholderPage title="Settings" />,
          },
        ],
      },
    ],
  },
]);
