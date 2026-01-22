import { createHashRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage, ErrorPage } from '../pages/error';
import { LandingPage } from '../pages/LandingPage';
import { InvoicesPage, InvoiceCreatePage, InvoiceDetailPage } from '../pages/invoices';
import { QuotationsPage, QuotationCreatePage, QuotationDetailPage } from '../pages/quotations';
import { InventoryPage, InventoryListPage, InventoryEditorPage, InventoryDetailPage } from '../pages/inventory';
import { PaymentsPage, PaymentDetailPage } from '../pages/payments';
import { AttendancePage } from '../pages/attendance';
import { DashboardPage } from '../pages/dashboard';
import { ProfilePage } from '../pages/profile';
import {
  EmployeesPage,
  EmployeeEditorPage,
  EmployeeDetailPage,
  EmployeePermissionsPage,
} from '../pages/employees';
import { ClientsPage, ClientEditorPage, ClientDetailPage } from '../pages/clients';
import { SettingsPage } from '../pages/settings';

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
        path: 'invoices/form',
        element: <InvoiceCreatePage />,
      },
      {
        path: 'invoices/form/:id',
        element: <InvoiceCreatePage />,
      },
      {
        path: 'invoices/:id',
        element: <InvoiceDetailPage />,
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
        path: 'quotations/:id',
        element: <QuotationDetailPage />,
      },
      {
        path: 'quotations/:id/edit',
        element: <QuotationCreatePage />,
      },
      {
        path: 'inventory',
        element: <InventoryListPage />,
      },
      {
        path: 'inventory/new',
        element: <InventoryEditorPage />,
      },
      {
        path: 'inventory/:id',
        element: <InventoryDetailPage />,
      },
      {
        path: 'payments',
        element: <PaymentsPage />,
      },
      {
        path: 'payments/:id',
        element: <PaymentDetailPage />,
      },
      {
        path: 'attendance',
        element: <AttendancePage />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      // Employee Management
      {
        path: 'employees',
        element: <EmployeesPage />,
      },
      {
        path: 'employees/new',
        element: <EmployeeEditorPage />,
      },
      {
        path: 'employees/:id',
        element: <EmployeeDetailPage />,
      },
      {
        path: 'employees/:id/edit',
        element: <EmployeeEditorPage />,
      },
      {
        path: 'employees/:id/permissions',
        element: <EmployeePermissionsPage />,
      },
      // Client Management
      {
        path: 'clients',
        element: <ClientsPage />,
      },
      {
        path: 'clients/new',
        element: <ClientEditorPage />,
      },
      {
        path: 'clients/:id',
        element: <ClientDetailPage />,
      },
      {
        path: 'clients/:id/edit',
        element: <ClientEditorPage />,
      },
      // Settings
      {
        path: 'settings',
        element: <SettingsPage />,
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
