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
import {
  EmployeesPage,
  EmployeeEditorPage,
  EmployeeDetailPage,
  EmployeePermissionsPage,
} from '../pages/employees';
import { ClientsPage, ClientEditorPage, ClientDetailPage } from '../pages/clients';
import { SuppliersPage, SupplierDetailPage, SupplierEditorPage } from '../pages/suppliers';
import { CreditNotesPage, CreditNoteDetailPage } from '../pages/credit-notes';
import { SalesManagementPage } from '../pages/sales';
import { RolesPage, RoleEditorPage } from '../pages/roles';
import { ProductListsPage, ProductListDetailPage } from '../pages/lists';
/**
 * Maps a route path to its corresponding React component
 * Used by the tab system to create components for tabbed routes
 */
export function getComponentForPath(path: string): React.ReactNode {
  // Remove leading slash for consistency
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;

  // Invoices
  if (cleanPath === 'invoices') return <InvoicesPage />;
  if (cleanPath === 'invoices/form' || cleanPath === 'invoices/new') return <InvoiceCreatePage />;
  if (cleanPath.match(/^invoices\/form\/\d+$/) || cleanPath.match(/^invoices\/edit\/\d+$/)) {
    return <InvoiceCreatePage />;
  }
  if (cleanPath.match(/^invoices\/\d+$/)) {
    return <InvoiceDetailPage />;
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
  if (cleanPath === 'inventory/manage') return <InventoryManagementPage />;
  if (cleanPath === 'inventory/manage/stock') return <BulkStockUpdatePage />;
  if (cleanPath === 'inventory/manage/receive') return <GoodsReceivalPage />;
  if (cleanPath === 'inventory/manage/mass-update') return <MassUpdatePage />;
  if (cleanPath.match(/^inventory\/\d+$/)) {
    return <InventoryDetailPage />;
  }
  if (cleanPath.match(/^inventory\/\d+\/edit$/)) {
    return <InventoryEditorPage />;
  }

  // Payments
  if (cleanPath === 'payments') return <PaymentsPage />;
  if (cleanPath.match(/^payments\/\d+$/)) {
    return <PaymentDetailPage />;
  }

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

  // Suppliers
  if (cleanPath === 'suppliers') return <SuppliersPage />;
  if (cleanPath === 'suppliers/new') return <SupplierEditorPage />;
  if (cleanPath.match(/^suppliers\/\d+$/)) {
    return <SupplierDetailPage />;
  }
  if (cleanPath.match(/^suppliers\/\d+\/edit$/)) {
    return <SupplierEditorPage />;
  }

  // Credit Notes
  if (cleanPath === 'credit-notes') return <CreditNotesPage />;
  if (cleanPath.match(/^credit-notes\/\d+$/)) return <CreditNoteDetailPage />;

  // Sales Management
  if (cleanPath === 'sales') return <SalesManagementPage />;

  // Product Lists (reorder pads)
  if (cleanPath === 'lists') return <ProductListsPage />;
  if (cleanPath.match(/^lists\/\d+$/)) return <ProductListDetailPage />;

  // Roles (RBAC)
  if (cleanPath === 'roles') return <RolesPage />;
  if (cleanPath === 'roles/new') return <RoleEditorPage />;
  if (cleanPath.match(/^roles\/\d+$/)) return <RoleEditorPage />;

  // Default fallback
  return <div>Page not found: {path}</div>;
}
