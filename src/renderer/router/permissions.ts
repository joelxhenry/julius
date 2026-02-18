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
export const authenticatedRoutes: RoutePermission[] = [
  { path: '/invoices', description: 'Search Invoices' },
  { path: '/invoices/form', description: 'Create Invoice' },
  { path: '/invoices/form/:id', description: 'Edit Invoice' },
  { path: '/invoices/:id', description: 'View Invoice' },
  { path: '/quotations', description: 'Search Quotations' },
  { path: '/quotations/new', description: 'Create Quotation' },
  { path: '/quotations/:id', description: 'View Quotation' },
  { path: '/inventory', description: 'Search Inventory' },
  { path: '/clients', description: 'Clients' },
  { path: '/clients/new', description: 'Create Client' },
  { path: '/clients/:id', description: 'View Client' },
  { path: '/suppliers', description: 'Suppliers' },
  { path: '/suppliers/new', description: 'Create Supplier' },
  { path: '/suppliers/:id', description: 'View Supplier' },
  { path: '/suppliers/:id/edit', description: 'Edit Supplier' },
  { path: '/payments', description: 'Process Payments' },
];

// Routes that require specific permissions
export const permissionProtectedRoutes: RoutePermission[] = [
  // Dashboard
  { path: '/dashboard', permission: 'VIEW_DASHBOARD', description: 'Dashboard' },
  { path: '/dashboard/reports', permission: 'VIEW_REPORTS', description: 'Reports' },
  { path: '/dashboard/settings', permission: 'MANAGE_SETTINGS', description: 'System Settings' },

  // Employee Management
  { path: '/employees', permission: 'VIEW_EMPLOYEES', description: 'Employee List' },
  { path: '/employees/new', permission: 'CREATE_EMPLOYEE', description: 'Create Employee' },
  { path: '/employees/:id', permission: 'VIEW_EMPLOYEES', description: 'Employee Details' },
  { path: '/employees/:id/edit', permission: 'EDIT_EMPLOYEE', description: 'Edit Employee' },
  { path: '/employees/:id/permissions', permission: 'MANAGE_PERMISSIONS', description: 'Manage Permissions' },
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
