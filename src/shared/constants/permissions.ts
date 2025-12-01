/**
 * Permission definitions for the application
 * These are used for access control throughout the app
 */

export interface PermissionDefinition {
  code: string;
  label: string;
  description: string;
  category: string;
}

export const PERMISSION_CATEGORIES = [
  'Dashboard',
  'Employees',
  'Invoices',
  'Quotations',
  'Inventory',
  'Payments',
  'Credit Notes',
  'Attendance',
  'Settings',
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export const PERMISSIONS: PermissionDefinition[] = [
  // Dashboard & Reports
  {
    code: 'VIEW_DASHBOARD',
    label: 'View Dashboard',
    description: 'Access the admin dashboard',
    category: 'Dashboard',
  },
  {
    code: 'VIEW_REPORTS',
    label: 'View Reports',
    description: 'Access business reports and analytics',
    category: 'Dashboard',
  },

  // Employee Management
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
    description: 'Deactivate employee accounts',
    category: 'Employees',
  },
  {
    code: 'MANAGE_PERMISSIONS',
    label: 'Manage Permissions',
    description: 'Manage employee access permissions',
    category: 'Employees',
  },

  // Invoices
  {
    code: 'VIEW_INVOICES',
    label: 'View Invoices',
    description: 'View invoice list and details',
    category: 'Invoices',
  },
  {
    code: 'CREATE_INVOICE',
    label: 'Create Invoice',
    description: 'Create new invoices',
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

  // Quotations
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

  // Inventory
  {
    code: 'VIEW_INVENTORY',
    label: 'View Inventory',
    description: 'View inventory items and stock levels',
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

  // Payments
  {
    code: 'VIEW_PAYMENTS',
    label: 'View Payments',
    description: 'View payment records',
    category: 'Payments',
  },
  {
    code: 'CREATE_PAYMENT',
    label: 'Create Payment',
    description: 'Record new payments',
    category: 'Payments',
  },
  {
    code: 'EDIT_PAYMENT',
    label: 'Edit Payment',
    description: 'Edit payment records',
    category: 'Payments',
  },
  {
    code: 'DELETE_PAYMENT',
    label: 'Delete Payment',
    description: 'Delete payment records',
    category: 'Payments',
  },

  // Credit Notes
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

  // Attendance
  {
    code: 'VIEW_ATTENDANCE',
    label: 'View Attendance',
    description: 'View attendance records',
    category: 'Attendance',
  },
  {
    code: 'MANAGE_ATTENDANCE',
    label: 'Manage Attendance',
    description: 'Edit and manage attendance records',
    category: 'Attendance',
  },

  // Settings
  {
    code: 'MANAGE_SETTINGS',
    label: 'Manage Settings',
    description: 'Access and modify system settings',
    category: 'Settings',
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
