/**
 * Permission definitions for the application.
 *
 * These codes are stored per-employee in `employees.permissions` (a JSON map of
 * `code -> boolean`) and drive access control throughout the app via the
 * permissions module (`src/renderer/permissions`) and route gating
 * (`src/renderer/router/permissions.ts`).
 *
 * Special codes:
 *  - `ADMIN` bypasses every check (see AuthContext.hasPermission).
 *
 * Derived from internal-docs/PERMISSIONS_INVENTORY.md. When adding a screen/action, add
 * its code here so it becomes manageable in the Employee Permissions UI.
 */

export interface PermissionDefinition {
  code: string;
  label: string;
  description: string;
  category: string;
}

export const PERMISSION_CATEGORIES = [
  'Administration',
  'Dashboard',
  'Reports',
  'Employees',
  'Invoices',
  'Quotations',
  'Credit Notes',
  'Inventory',
  'Product Lists',
  'Receiving',
  'Clients',
  'Suppliers',
  'Payments',
  'Attendance',
  'Settings',
  'Overrides',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const PERMISSIONS: PermissionDefinition[] = [
  // ===== Administration =====
  {
    code: 'ADMIN',
    label: 'Full Administrator Access',
    description: 'Bypasses all permission checks — grants unrestricted access to every feature',
    category: 'Administration',
  },

  // ===== Dashboard =====
  {
    code: 'VIEW_DASHBOARD',
    label: 'View Dashboard',
    description: 'Access the admin dashboard',
    category: 'Dashboard',
  },

  // ===== Reports =====
  {
    code: 'VIEW_REPORTS',
    label: 'View Reports',
    description: 'Access business reports and analytics',
    category: 'Reports',
  },
  {
    code: 'EXPORT_REPORT',
    label: 'Export Reports & Data',
    description: 'Export report and list data to CSV/Excel',
    category: 'Reports',
  },

  // ===== Employees =====
  {
    code: 'VIEW_EMPLOYEES',
    label: 'View Employees',
    description: 'View employee list and details',
    category: 'Employees',
  },
  {
    code: 'CREATE_EMPLOYEE',
    label: 'Create Employee',
    description: 'Create new employee accounts',
    category: 'Employees',
  },
  {
    code: 'EDIT_EMPLOYEE',
    label: 'Edit Employee',
    description: 'Edit employee information',
    category: 'Employees',
  },
  {
    code: 'DEACTIVATE_EMPLOYEE',
    label: 'Deactivate Employee',
    description: 'Deactivate or delete employee accounts',
    category: 'Employees',
  },
  {
    code: 'MANAGE_PERMISSIONS',
    label: 'Manage Permissions',
    description: 'Assign roles to employees',
    category: 'Employees',
  },
  {
    code: 'MANAGE_ROLES',
    label: 'Manage Roles',
    description: 'Create and edit RBAC roles and their permissions',
    category: 'Employees',
  },
  {
    code: 'RESET_EMPLOYEE_PASSWORD',
    label: 'Reset Employee Password',
    description: "Reset another employee's password",
    category: 'Employees',
  },

  // ===== Invoices =====
  {
    code: 'VIEW_INVOICES',
    label: 'View Invoices',
    description: 'View invoice list and details',
    category: 'Invoices',
  },
  {
    code: 'CREATE_INVOICE',
    label: 'Create Invoice',
    description: 'Create and issue new invoices',
    category: 'Invoices',
  },
  {
    code: 'EDIT_INVOICE',
    label: 'Edit Invoice',
    description: 'Edit existing invoices',
    category: 'Invoices',
  },
  {
    code: 'DELETE_INVOICE',
    label: 'Delete Invoice',
    description: 'Delete invoices',
    category: 'Invoices',
  },
  {
    code: 'ARCHIVE_INVOICE',
    label: 'Archive Invoice',
    description: 'Archive invoices',
    category: 'Invoices',
  },
  {
    code: 'PROCESS_RETURN',
    label: 'Process Return',
    description: 'Process invoice returns and refunds',
    category: 'Invoices',
  },

  // ===== Quotations =====
  {
    code: 'VIEW_QUOTATIONS',
    label: 'View Quotations',
    description: 'View quotation list and details',
    category: 'Quotations',
  },
  {
    code: 'CREATE_QUOTATION',
    label: 'Create Quotation',
    description: 'Create new quotations',
    category: 'Quotations',
  },
  {
    code: 'EDIT_QUOTATION',
    label: 'Edit Quotation',
    description: 'Edit existing quotations',
    category: 'Quotations',
  },
  {
    code: 'DELETE_QUOTATION',
    label: 'Delete Quotation',
    description: 'Delete quotations',
    category: 'Quotations',
  },
  {
    code: 'CONVERT_QUOTATION',
    label: 'Convert Quotation',
    description: 'Convert quotations to invoices',
    category: 'Quotations',
  },
  {
    code: 'ARCHIVE_QUOTATION',
    label: 'Archive / Expire Quotation',
    description: 'Archive or expire quotations',
    category: 'Quotations',
  },

  // ===== Credit Notes =====
  {
    code: 'VIEW_CREDIT_NOTES',
    label: 'View Credit Notes',
    description: 'View credit note list and details',
    category: 'Credit Notes',
  },
  {
    code: 'CREATE_CREDIT_NOTE',
    label: 'Create Credit Note',
    description: 'Create new credit notes',
    category: 'Credit Notes',
  },
  {
    code: 'EDIT_CREDIT_NOTE',
    label: 'Edit Credit Note',
    description: 'Edit existing credit notes',
    category: 'Credit Notes',
  },
  {
    code: 'DELETE_CREDIT_NOTE',
    label: 'Delete Credit Note',
    description: 'Delete credit notes',
    category: 'Credit Notes',
  },
  {
    code: 'ARCHIVE_CREDIT_NOTE',
    label: 'Archive Credit Note',
    description: 'Archive credit notes',
    category: 'Credit Notes',
  },
  {
    code: 'RESTORE_CN_INVENTORY',
    label: 'Restore Credit Note Inventory',
    description: 'Restore inventory from a credit note',
    category: 'Credit Notes',
  },
  {
    code: 'REFUND_CREDIT_NOTE',
    label: 'Cash Out / Refund Credit Note',
    description: 'Pay out a credit note’s remaining balance to the customer',
    category: 'Credit Notes',
  },

  // ===== Inventory =====
  {
    code: 'VIEW_INVENTORY',
    label: 'View Inventory',
    description: 'View inventory items and stock levels',
    category: 'Inventory',
  },
  {
    code: 'VIEW_COST',
    label: 'View Cost & Margin',
    description: 'See item cost and profit margin (hidden/masked otherwise)',
    category: 'Inventory',
  },
  {
    code: 'VIEW_INVENTORY_SALES',
    label: 'View Sales History',
    description: 'See the Sales tab (sales history and revenue) on inventory items',
    category: 'Inventory',
  },
  {
    code: 'VIEW_INVENTORY_ACTIVITY',
    label: 'View Activity History',
    description: 'See the Activity tab (stock movements and transactions) on inventory items',
    category: 'Inventory',
  },
  {
    code: 'CREATE_INVENTORY',
    label: 'Create Inventory',
    description: 'Add new inventory items',
    category: 'Inventory',
  },
  {
    code: 'EDIT_INVENTORY',
    label: 'Edit Inventory',
    description: 'Edit inventory item details',
    category: 'Inventory',
  },
  {
    code: 'DELETE_INVENTORY',
    label: 'Delete Inventory',
    description: 'Delete inventory items',
    category: 'Inventory',
  },
  {
    code: 'ADJUST_STOCK',
    label: 'Adjust Stock',
    description: 'Adjust inventory stock levels',
    category: 'Inventory',
  },
  {
    code: 'BULK_STOCK_UPDATE',
    label: 'Bulk Stock Update',
    description: 'Adjust on-hand quantities for many items at once',
    category: 'Inventory',
  },
  {
    code: 'MASS_UPDATE_INVENTORY',
    label: 'Mass Update Inventory',
    description: 'Bulk-edit price, stock, supplier, vehicle and more via import',
    category: 'Inventory',
  },
  {
    code: 'MANAGE_VARIANTS',
    label: 'Manage Variants',
    description: 'Create, edit and delete product variants',
    category: 'Inventory',
  },
  {
    code: 'MANAGE_ALTERNATES',
    label: 'Manage Alternates',
    description: 'Add and remove alternate part numbers',
    category: 'Inventory',
  },
  {
    code: 'MANAGE_INVENTORY_IMAGES',
    label: 'Manage Inventory Images',
    description: 'Upload, reorder and remove product images',
    category: 'Inventory',
  },

  // ===== Product Lists (reorder pads) =====
  {
    code: 'VIEW_PRODUCT_LISTS',
    label: 'View Product Lists',
    description: 'View reorder/product lists and their items',
    category: 'Product Lists',
  },
  {
    code: 'MANAGE_PRODUCT_LISTS',
    label: 'Manage Product Lists',
    description: 'Create and edit lists, add/remove items, and change list status',
    category: 'Product Lists',
  },
  {
    code: 'DELETE_PRODUCT_LIST',
    label: 'Delete Product List',
    description: 'Delete product lists',
    category: 'Product Lists',
  },

  // ===== Receiving (Goods Receival) =====
  {
    code: 'RECEIVE_GOODS',
    label: 'Receive Goods',
    description: 'Record supplier receivals and post goods',
    category: 'Receiving',
  },
  {
    code: 'IMPORT_RECEIVAL',
    label: 'Import Receival',
    description: 'Import receivals from a file',
    category: 'Receiving',
  },

  // ===== Clients =====
  {
    code: 'VIEW_CLIENTS',
    label: 'View Clients',
    description: 'View client list and details',
    category: 'Clients',
  },
  {
    code: 'CREATE_CLIENT',
    label: 'Create Client',
    description: 'Create new clients',
    category: 'Clients',
  },
  {
    code: 'EDIT_CLIENT',
    label: 'Edit Client',
    description: 'Edit client information',
    category: 'Clients',
  },
  {
    code: 'DELETE_CLIENT',
    label: 'Delete Client',
    description: 'Delete clients',
    category: 'Clients',
  },
  {
    code: 'CLIENT_BULK_PAYMENT',
    label: 'Receive Client Payment',
    description: 'Record bulk/allocated payments against a client',
    category: 'Clients',
  },
  {
    code: 'VIEW_CLIENT_STATEMENT',
    label: 'View Client Statement',
    description: 'Generate and print client balance statements',
    category: 'Clients',
  },

  // ===== Suppliers =====
  {
    code: 'VIEW_SUPPLIERS',
    label: 'View Suppliers',
    description: 'View supplier list and details',
    category: 'Suppliers',
  },
  {
    code: 'CREATE_SUPPLIER',
    label: 'Create Supplier',
    description: 'Create new suppliers',
    category: 'Suppliers',
  },
  {
    code: 'EDIT_SUPPLIER',
    label: 'Edit Supplier',
    description: 'Edit supplier information',
    category: 'Suppliers',
  },
  {
    code: 'DELETE_SUPPLIER',
    label: 'Delete Supplier',
    description: 'Delete suppliers',
    category: 'Suppliers',
  },
  {
    code: 'ACTIVATE_SUPPLIER',
    label: 'Activate / Deactivate Supplier',
    description: 'Activate or deactivate supplier accounts',
    category: 'Suppliers',
  },
  {
    code: 'MANAGE_BILLS',
    label: 'Manage Bills',
    description: 'View and manage supplier bills and payments',
    category: 'Suppliers',
  },

  // ===== Payments =====
  {
    code: 'VIEW_PAYMENTS',
    label: 'View Payments',
    description: 'View payment records',
    category: 'Payments',
  },
  {
    code: 'CREATE_PAYMENT',
    label: 'Record Payment',
    description: 'Record new payments',
    category: 'Payments',
  },
  {
    code: 'VOID_PAYMENT',
    label: 'Void Payment',
    description: 'Void/reverse recorded payments',
    category: 'Payments',
  },
  {
    code: 'REFUND_INVOICE',
    label: 'Refund Invoice',
    description: 'Issue money refunds against invoices',
    category: 'Payments',
  },
  {
    code: 'MANAGE_GCT_PAYMENTS',
    label: 'Manage GCT Payments',
    description: 'Record and manage government tax (GCT) payments',
    category: 'Payments',
  },
  {
    code: 'MANAGE_PAYMENT_METHODS',
    label: 'Manage Payment Methods',
    description: 'Create, edit and delete payment methods',
    category: 'Payments',
  },

  // ===== Attendance =====
  {
    code: 'VIEW_ATTENDANCE',
    label: 'View Attendance',
    description: 'View attendance records',
    category: 'Attendance',
  },
  {
    code: 'MANAGE_ATTENDANCE',
    label: 'Manage Attendance',
    description: 'Edit and manage attendance records and shifts',
    category: 'Attendance',
  },

  // ===== Settings =====
  {
    code: 'MANAGE_SETTINGS',
    label: 'Manage Settings',
    description: 'Access system settings (umbrella permission)',
    category: 'Settings',
  },
  {
    code: 'MANAGE_DATABASE',
    label: 'Manage Database',
    description: 'Edit database configuration and run migrations/seeds',
    category: 'Settings',
  },
  {
    code: 'MANAGE_COMPANY',
    label: 'Manage Company Settings',
    description: 'Edit company information',
    category: 'Settings',
  },
  {
    code: 'MANAGE_DOCUMENTS',
    label: 'Manage Document Settings',
    description: 'Edit document numbering and templates',
    category: 'Settings',
  },
  {
    code: 'MANAGE_TAX',
    label: 'Manage Tax Settings',
    description: 'Edit tax/GCT rates',
    category: 'Settings',
  },
  {
    code: 'MANAGE_STORAGE',
    label: 'Manage Storage Settings',
    description: 'Edit the file storage path',
    category: 'Settings',
  },
  {
    code: 'MANAGE_INTERFACE',
    label: 'Manage Interface Settings',
    description: 'Edit interface/UI preferences',
    category: 'Settings',
  },

  // ===== Overrides (sensitive one-time elevations) =====
  {
    code: 'ADMIN_OVERRIDE',
    label: 'Approve Admin Overrides',
    description: 'Authorise generic admin overrides for restricted actions',
    category: 'Overrides',
  },
  {
    code: 'OVERRIDE_CREDIT',
    label: 'Override Credit Limit',
    description: 'Approve invoices that bypass client credit restrictions',
    category: 'Overrides',
  },
  {
    code: 'OVERRIDE_NEGATIVE_STOCK',
    label: 'Override Negative Stock',
    description: 'Approve invoices that take stock negative',
    category: 'Overrides',
  },
  {
    code: 'OVERRIDE_PRICE',
    label: 'Override Pricing',
    description: 'Apply bulk discounts / target-total price overrides',
    category: 'Overrides',
  },
];

/**
 * Get permissions grouped by category
 */
export function getPermissionsByCategory(): Record<PermissionCategory, PermissionDefinition[]> {
  const grouped = {} as Record<PermissionCategory, PermissionDefinition[]>;

  for (const category of PERMISSION_CATEGORIES) {
    grouped[category] = PERMISSIONS.filter((p) => p.category === category);
  }

  return grouped;
}

/**
 * Get a permission definition by code
 */
export function getPermissionByCode(code: string): PermissionDefinition | undefined {
  return PERMISSIONS.find((p) => p.code === code);
}

/**
 * All permission codes as a type
 */
export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

/**
 * Permission codes array for easy access
 */
export const PERMISSION_CODES = PERMISSIONS.map((p) => p.code);
