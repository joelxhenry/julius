import { createHashRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage, ErrorPage } from '../pages/error';
import { LandingPage } from '../pages/LandingPage';
import { InvoicesPage, InvoiceCreatePage } from '../pages/invoices';
import { QuotationsPage, QuotationCreatePage } from '../pages/quotations';
import { InventoryPage } from '../pages/inventory';
import { PaymentsPage } from '../pages/payments';
import { AttendancePage } from '../pages/attendance';
import { DashboardPage } from '../pages/dashboard';

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <LandingPage />,
      },
      {
        path: 'invoices',
        element: <InvoicesPage />,
      },
      {
        path: 'invoices/new',
        element: <InvoiceCreatePage />,
      },
      {
        path: 'quotations',
        element: <QuotationsPage />,
      },
      {
        path: 'quotations/new',
        element: <QuotationCreatePage />,
      },
      {
        path: 'inventory',
        element: <InventoryPage />,
      },
      {
        path: 'payments',
        element: <PaymentsPage />,
      },
      {
        path: 'attendance',
        element: <AttendancePage />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      // Catch-all for 404 within app layout
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
  // Global catch-all for 404
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
