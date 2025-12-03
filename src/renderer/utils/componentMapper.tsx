import { InvoicesPage, InvoiceCreatePage, InvoiceDetailPage } from '../pages/invoices';
import { QuotationsPage, QuotationCreatePage, QuotationDetailPage } from '../pages/quotations';
import { InventoryListPage, InventoryEditorPage, InventoryDetailPage } from '../pages/inventory';
import { PaymentsPage } from '../pages/payments';
import { AttendancePage } from '../pages/attendance';
import {
  EmployeesPage,
  EmployeeEditorPage,
  EmployeeDetailPage,
  EmployeePermissionsPage,
} from '../pages/employees';
import { ClientsPage, ClientEditorPage, ClientDetailPage } from '../pages/clients';

/**
 * Maps a route path to its corresponding React component
 * Used by the tab system to create components for tabbed routes
 */
export function getComponentForPath(path: string): React.ReactNode {
  // Remove leading slash for consistency
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;

  // Invoices
  if (cleanPath === 'invoices') return <InvoicesPage />;
  if (cleanPath === 'invoices/new') return <InvoiceCreatePage />;
  if (cleanPath.match(/^invoices\/\d+$/)) {
    return <InvoiceDetailPage />;
  }
  if (cleanPath.match(/^invoices\/\d+\/edit$/)) {
    return <InvoiceCreatePage />;
  }

  // Quotations
  if (cleanPath === 'quotations') return <QuotationsPage />;
  if (cleanPath === 'quotations/new') return <QuotationCreatePage />;
  if (cleanPath.match(/^quotations\/\d+$/)) {
    return <QuotationDetailPage />;
  }
  if (cleanPath.match(/^quotations\/\d+\/edit$/)) {
    return <QuotationCreatePage />;
  }

  // Inventory
  if (cleanPath === 'inventory') return <InventoryListPage />;
  if (cleanPath === 'inventory/new') return <InventoryEditorPage />;
  if (cleanPath.match(/^inventory\/\d+$/)) {
    return <InventoryDetailPage />;
  }
  if (cleanPath.match(/^inventory\/\d+\/edit$/)) {
    return <InventoryEditorPage />;
  }

  // Payments
  if (cleanPath === 'payments') return <PaymentsPage />;

  // Attendance
  if (cleanPath === 'attendance') return <AttendancePage />;

  // Employees
  if (cleanPath === 'employees') return <EmployeesPage />;
  if (cleanPath === 'employees/new') return <EmployeeEditorPage />;
  if (cleanPath.match(/^employees\/\d+$/)) {
    return <EmployeeDetailPage />;
  }
  if (cleanPath.match(/^employees\/\d+\/edit$/)) {
    return <EmployeeEditorPage />;
  }
  if (cleanPath.match(/^employees\/\d+\/permissions$/)) {
    return <EmployeePermissionsPage />;
  }

  // Clients
  if (cleanPath === 'clients') return <ClientsPage />;
  if (cleanPath === 'clients/new') return <ClientEditorPage />;
  if (cleanPath.match(/^clients\/\d+$/)) {
    return <ClientDetailPage />;
  }
  if (cleanPath.match(/^clients\/\d+\/edit$/)) {
    return <ClientEditorPage />;
  }

  // Default fallback
  return <div>Page not found: {path}</div>;
}
