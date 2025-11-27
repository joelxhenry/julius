/**
 * Tab System Type Definitions
 */

export type TabType =
  | 'dashboard'
  | 'invoices-list'
  | 'invoice-editor'
  | 'quotations-list'
  | 'quotation-editor'
  | 'clients-list'
  | 'client-detail'
  | 'parts-list'
  | 'part-detail'
  | 'payments-list'
  | 'credit-notes-list'
  | 'users-list'
  | 'user-detail'
  | 'settings';

export interface Tab {
  id: string;                    // Unique: `${type}-${entityId}-${uuid}`
  type: TabType;                 // Type of tab for styling and behavior
  entityId: string | null;       // ID from URL params (e.g., invoice ID)
  path: string;                  // Full route path (e.g., '/invoices/123')
  title: string;                 // Display title in tab
  isDirty: boolean;              // Has unsaved changes
  createdAt: number;             // Timestamp for ordering
}

export interface TabManagerState {
  tabs: Tab[];
  activeTabId: string | null;
}

export interface OpenTabConfig {
  type: TabType;
  path: string;
  title: string;
  entityId?: string | null;
}

export interface TabManagerContextType {
  // State
  tabs: Tab[];
  activeTabId: string | null;

  // Actions
  openTab: (config: OpenTabConfig, forceNew?: boolean) => string;
  closeTab: (tabId: string, force?: boolean) => Promise<boolean>;
  closeOtherTabs: (tabId: string) => Promise<void>;
  closeAllTabs: () => Promise<void>;
  activateTab: (tabId: string) => void;
  nextTab: () => void;
  prevTab: () => void;

  // Tab state updates
  setTabDirty: (tabId: string, isDirty: boolean) => void;
  setTabTitle: (tabId: string, title: string) => void;

  // Utilities
  findTabByPath: (path: string) => Tab | undefined;
  findTabsByType: (type: TabType) => Tab[];
  getActiveTab: () => Tab | undefined;
  getTabCount: () => number;
}

// Color mapping for tab types
export const TAB_COLORS: Record<TabType, string> = {
  'dashboard': 'gray',
  'invoices-list': 'blue',
  'invoice-editor': 'blue',
  'quotations-list': 'violet',
  'quotation-editor': 'violet',
  'clients-list': 'green',
  'client-detail': 'green',
  'parts-list': 'orange',
  'part-detail': 'orange',
  'payments-list': 'teal',
  'credit-notes-list': 'red',
  'users-list': 'cyan',
  'user-detail': 'cyan',
  'settings': 'gray',
};

// List tab types (single instance only)
export const LIST_TAB_TYPES: TabType[] = [
  'dashboard',
  'invoices-list',
  'quotations-list',
  'clients-list',
  'parts-list',
  'payments-list',
  'credit-notes-list',
  'users-list',
  'settings',
];

// Maximum number of tabs before warning
export const MAX_TABS_WARNING = 20;

// Helper to check if a tab type is a list type (single instance)
export function isListTabType(type: TabType): boolean {
  return LIST_TAB_TYPES.includes(type);
}

// Helper to derive tab type from path
export function getTabTypeFromPath(path: string): TabType {
  if (path === '/') return 'dashboard';
  if (path === '/invoices') return 'invoices-list';
  if (path.startsWith('/invoices/')) return 'invoice-editor';
  if (path === '/quotations') return 'quotations-list';
  if (path.startsWith('/quotations/')) return 'quotation-editor';
  if (path === '/clients') return 'clients-list';
  if (path.startsWith('/clients/')) return 'client-detail';
  if (path === '/inventory/parts') return 'parts-list';
  if (path.startsWith('/inventory/parts/')) return 'part-detail';
  if (path === '/payments') return 'payments-list';
  if (path === '/credit-notes') return 'credit-notes-list';
  if (path === '/users') return 'users-list';
  if (path.startsWith('/users/')) return 'user-detail';
  if (path === '/settings') return 'settings';
  return 'dashboard'; // fallback
}

// Helper to get default tab title from path
export function getDefaultTabTitle(path: string, type: TabType): string {
  const titles: Partial<Record<TabType, string>> = {
    'dashboard': 'Dashboard',
    'invoices-list': 'Invoices',
    'quotations-list': 'Quotations',
    'clients-list': 'Clients',
    'parts-list': 'Parts',
    'payments-list': 'Payments',
    'credit-notes-list': 'Credit Notes',
    'users-list': 'Users',
    'settings': 'Settings',
  };

  if (titles[type]) return titles[type]!;

  // For detail/editor pages, extract ID from path
  const match = path.match(/\/([^/]+)$/);
  const id = match?.[1];

  if (id === 'new') {
    if (type === 'invoice-editor') return 'New Invoice';
    if (type === 'quotation-editor') return 'New Quotation';
    if (type === 'client-detail') return 'New Client';
    if (type === 'part-detail') return 'New Part';
    if (type === 'user-detail') return 'New User';
  }

  if (type === 'invoice-editor') return `Invoice #${id}`;
  if (type === 'quotation-editor') return `Quotation #${id}`;
  if (type === 'client-detail') return `Client #${id}`;
  if (type === 'part-detail') return `Part #${id}`;
  if (type === 'user-detail') return `User #${id}`;

  return 'Tab';
}

// Extract entity ID from path
export function getEntityIdFromPath(path: string): string | null {
  const match = path.match(/\/([^/]+)$/);
  return match?.[1] || null;
}
