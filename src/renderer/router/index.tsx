import { createHashRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage, ErrorPage } from '../pages/error';
import { LandingPage } from '../pages/LandingPage';
import { InvoicesPage, InvoiceCreatePage, InvoiceDetailPage } from '../pages/invoices';
import { QuotationsPage, QuotationCreatePage, QuotationDetailPage } from '../pages/quotations';
import {
  InventoryListPage,
  InventoryEditorPage,
  InventoryDetailPage,
  InventoryManagementPage,
  BulkStockUpdatePage,
  GoodsReceivalPage,
  MassUpdatePage,
} from '../pages/inventory';
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
import { SuppliersPage, SupplierDetailPage, SupplierEditorPage } from '../pages/suppliers';
import { SettingsPage } from '../pages/settings';
import { ReportsPage } from '../pages/reports';
import { SalesManagementPage } from '../pages/sales';
import { CreditNotesPage, CreditNoteDetailPage } from '../pages/credit-notes';
import { RolesPage, RoleEditorPage } from '../pages/roles';
import { ProductListsPage, ProductListDetailPage } from '../pages/lists';

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
        path: 'invoices/edit/:id',
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
      // Credit Notes
      {
        path: 'credit-notes',
        element: <CreditNotesPage />,
      },
      {
        path: 'credit-notes/:id',
        element: <CreditNoteDetailPage />,
      },
      // Sales Management
      {
        path: 'sales',
        element: <SalesManagementPage />,
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
        path: 'inventory/manage',
        element: <InventoryManagementPage />,
      },
      {
        path: 'inventory/manage/stock',
        element: <BulkStockUpdatePage />,
      },
      {
        path: 'inventory/manage/receive',
        element: <GoodsReceivalPage />,
      },
      {
        path: 'inventory/manage/mass-update',
        element: <MassUpdatePage />,
      },
      {
        path: 'inventory/:id',
        element: <InventoryDetailPage />,
      },
      // Product Lists (reorder pads)
      {
        path: 'lists',
        element: <ProductListsPage />,
      },
      {
        path: 'lists/:id',
        element: <ProductListDetailPage />,
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
      // Role Management (RBAC)
      {
        path: 'roles',
        element: <RolesPage />,
      },
      {
        path: 'roles/new',
        element: <RoleEditorPage />,
      },
      {
        path: 'roles/:id',
        element: <RoleEditorPage />,
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
      // Supplier Management
      {
        path: 'suppliers',
        element: <SuppliersPage />,
      },
      {
        path: 'suppliers/new',
        element: <SupplierEditorPage />,
      },
      {
        path: 'suppliers/:id',
        element: <SupplierDetailPage />,
      },
      {
        path: 'suppliers/:id/edit',
        element: <SupplierEditorPage />,
      },
      // Reports
      {
        path: 'reports',
        element: <ReportsPage />,
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
