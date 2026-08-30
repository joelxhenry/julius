/**
 * Route permissions configuration
 * Maps routes to required permission codes
 *
 * Permission codes should match what's stored in the employee.permissions JSONB field
 * Special permission: 'ADMIN' bypasses all permission checks
 */

export interface RoutePermission {
  path: string;
  permission?: string; // If undefined, only requires authentication (no specific permission)
  description: string;
}

// Routes that require authentication but no specific permission
// Just need a valid PIN/session
export const authenticatedRoutes: RoutePermission[] = [];

// Routes that require specific permissions.
// Order matters: more specific paths (create/edit) must come before the list/detail
// patterns so getRoutePermission matches them first.
export const permissionProtectedRoutes: RoutePermission[] = [
  // Dashboard
  { path: '/dashboard', permission: 'VIEW_DASHBOARD', description: 'Dashboard' },

  // Reports
  { path: '/reports', permission: 'VIEW_REPORTS', description: 'Reports' },

  // Settings
  { path: '/settings', permission: 'MANAGE_SETTINGS', description: 'System Settings' },

  // Sales Management hub
  { path: '/sales', permission: 'VIEW_INVOICES', description: 'Sales Management' },

  // Invoices
  { path: '/invoices/form', permission: 'CREATE_INVOICE', description: 'Create Invoice' },
  { path: '/invoices/edit/:id', permission: 'EDIT_INVOICE', description: 'Edit Invoice' },
  { path: '/invoices/:id', permission: 'VIEW_INVOICES', description: 'View Invoice' },
  { path: '/invoices', permission: 'VIEW_INVOICES', description: 'Invoices' },

  // Quotations
  { path: '/quotations/new', permission: 'CREATE_QUOTATION', description: 'Create Quotation' },
  { path: '/quotations/:id/edit', permission: 'EDIT_QUOTATION', description: 'Edit Quotation' },
  { path: '/quotations/:id', permission: 'VIEW_QUOTATIONS', description: 'View Quotation' },
  { path: '/quotations', permission: 'VIEW_QUOTATIONS', description: 'Quotations' },

  // Credit Notes
  { path: '/credit-notes/:id', permission: 'VIEW_CREDIT_NOTES', description: 'View Credit Note' },
  { path: '/credit-notes', permission: 'VIEW_CREDIT_NOTES', description: 'Credit Notes' },

  // Inventory
  { path: '/inventory/new', permission: 'CREATE_INVENTORY', description: 'Create Inventory Item' },
  { path: '/inventory/manage/stock', permission: 'BULK_STOCK_UPDATE', description: 'Update Stock' },
  { path: '/inventory/manage/receive', permission: 'RECEIVE_GOODS', description: 'Receive Parts' },
  { path: '/inventory/manage/mass-update', permission: 'MASS_UPDATE_INVENTORY', description: 'Mass Update' },
  { path: '/inventory/manage', permission: 'EDIT_INVENTORY', description: 'Inventory Management' },
  { path: '/inventory/:id', permission: 'VIEW_INVENTORY', description: 'View Inventory Item' },
  { path: '/inventory', permission: 'VIEW_INVENTORY', description: 'Inventory' },

  // Clients
  { path: '/clients/new', permission: 'CREATE_CLIENT', description: 'Create Client' },
  { path: '/clients/:id', permission: 'VIEW_CLIENTS', description: 'View Client' },
  { path: '/clients', permission: 'VIEW_CLIENTS', description: 'Clients' },

  // Suppliers
  { path: '/suppliers/new', permission: 'CREATE_SUPPLIER', description: 'Create Supplier' },
  { path: '/suppliers/:id/edit', permission: 'EDIT_SUPPLIER', description: 'Edit Supplier' },
  { path: '/suppliers/:id', permission: 'VIEW_SUPPLIERS', description: 'View Supplier' },
  { path: '/suppliers', permission: 'VIEW_SUPPLIERS', description: 'Suppliers' },

  // Payments
  { path: '/payments/:id', permission: 'VIEW_PAYMENTS', description: 'View Payment' },
  { path: '/payments', permission: 'VIEW_PAYMENTS', description: 'Payments' },

  // Role Management (RBAC)
  { path: '/roles/new', permission: 'MANAGE_ROLES', description: 'Create Role' },
  { path: '/roles/:id', permission: 'MANAGE_ROLES', description: 'Edit Role' },
  { path: '/roles', permission: 'MANAGE_ROLES', description: 'Roles' },

  // Employee Management
  { path: '/employees/new', permission: 'CREATE_EMPLOYEE', description: 'Create Employee' },
  { path: '/employees/:id/edit', permission: 'EDIT_EMPLOYEE', description: 'Edit Employee' },
  { path: '/employees/:id/permissions', permission: 'MANAGE_PERMISSIONS', description: 'Manage Permissions' },
  { path: '/employees/:id', permission: 'VIEW_EMPLOYEES', description: 'Employee Details' },
  { path: '/employees', permission: 'VIEW_EMPLOYEES', description: 'Employee List' },
];

// Public routes (no authentication required)
export const publicRoutes: string[] = [
  '/',
  '/login',
  '/attendance',
];

// Routes that require full password authentication (not just PIN)
// These are sensitive routes that need stronger verification
export const passwordProtectedRoutes: RoutePermission[] = [
  { path: '/profile', description: 'My Profile' },
];

/**
 * Get the required permission for a given path
 * Returns undefined for public routes
 * Returns null for authenticated-only routes (no specific permission)
 * Returns the permission code for permission-protected routes
 */
export function getRoutePermission(path: string): string | null | undefined {
  // Check public routes first
  if (publicRoutes.includes(path)) {
    return undefined; // No auth required
  }

  // Check permission-protected routes (exact match first, then pattern match)
  for (const route of permissionProtectedRoutes) {
    if (matchRoute(path, route.path)) {
      return route.permission;
    }
  }

  // Check authenticated routes
  for (const route of authenticatedRoutes) {
    if (matchRoute(path, route.path)) {
      return null; // Auth required but no specific permission
    }
  }

  // Default: require authentication for unknown routes
  return null;
}

/**
 * Check if a path matches a route pattern
 * Supports :param style patterns
 */
function matchRoute(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) return true;

  // Pattern match (e.g., /invoices/:id matches /invoices/123)
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');

  if (pathParts.length !== patternParts.length) return false;

  return patternParts.every((part, index) => {
    if (part.startsWith(':')) return true; // Wildcard match
    return part === pathParts[index];
  });
}

/**
 * Check if a route is public
 */
export function isPublicRoute(path: string): boolean {
  return getRoutePermission(path) === undefined;
}

/**
 * Check if a route requires authentication only (no specific permission)
 */
export function isAuthOnlyRoute(path: string): boolean {
  return getRoutePermission(path) === null;
}

/**
 * Get the description for a route
 */
export function getRouteDescription(path: string): string {
  for (const route of [...authenticatedRoutes, ...permissionProtectedRoutes, ...passwordProtectedRoutes]) {
    if (matchRoute(path, route.path)) {
      return route.description;
    }
  }
  return 'this feature';
}

/**
 * Check if a route requires password authentication (not just PIN)
 */
export function isPasswordProtectedRoute(path: string): boolean {
  for (const route of passwordProtectedRoutes) {
    if (matchRoute(path, route.path)) {
      return true;
    }
  }
  return false;
}
