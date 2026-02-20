import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useAuth } from './AuthContext';

// Tab interface
export interface Tab {
  id: string;
  path: string;
  title: string;
  hasUnsavedChanges?: boolean;
  component: React.ReactNode;
  createdAt: number;
  lastAccessedAt: number;
}

interface TabContextValue {
  tabs: Tab[];
  activeTab: Tab | null;
  maxTabs: number;

  // Navigation
  openTab: (path: string, component?: React.ReactNode) => void;
  closeTab: (tabId: string) => Promise<boolean>;
  switchToTab: (tabId: string) => void;
  replaceCurrentTab: (path: string) => void;

  // Management
  updateTabTitle: (tabIdOrPath: string, title: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => void;

  // Utility
  findTabByPath: (path: string) => Tab | null;
  isTabbed: (path: string) => boolean;
  canOpenMoreTabs: () => boolean;

  // Keyboard navigation
  closeCurrentTab: () => void;
  nextTab: () => void;
  previousTab: () => void;
  selectTabByIndex: (index: number) => void;

  // Settings
  setMaxTabs: (max: number) => void;
}

const TabContext = createContext<TabContextValue | undefined>(undefined);

const TABS_STORAGE_KEY = 'turbo-julius-tabs';
const TAB_SETTINGS_KEY = 'turbo-julius-tab-settings';
const DEFAULT_MAX_TABS = 10;

// Pages that should NOT open in tabs
const EXCLUDED_ROUTES = ['/', '/dashboard', '/profile', '/settings', '/attendance', '/reports'];

// Helper function to check if a path is excluded
function isExcludedRoute(path: string): boolean {
  return EXCLUDED_ROUTES.includes(path);
}

// Helper function to generate initial tab title from path
function generateTitleFromPath(path: string): string {
  if (path === '/invoices/form') return 'New Invoice';
 
  if (path.startsWith('/invoices/edit')) {
    const id = path.split('/')[3];
    return `Edit Invoice #${id}`;
  }

  if (path.startsWith('/invoices/')) {
    const id = path.split('/')[2];
    return `Invoice #${id}`;
  }
  
  if (path.includes('/quotations/new')) return 'New Quotation';
  if (path.includes('/quotations/')) return 'Quotation';
  if (path.includes('/inventory/new')) return 'New Item';
  if (path.includes('/inventory/') && path.includes('/edit')) return 'Edit Item';
  if (path.includes('/employees/new')) return 'New Employee';
  if (path.includes('/employees/') && path.includes('/edit')) return 'Edit Employee';
  if (path.includes('/employees/') && path.includes('/permissions')) return 'Employee Permissions';
  if (path.includes('/employees/')) return 'Employee';
  if (path.includes('/clients/new')) return 'New Client';
  if (path.includes('/clients/') && path.includes('/edit')) return 'Edit Client';
  if (path.includes('/clients/')) return 'Client Details';
  if (path === '/clients') return 'Clients';
  if (path.includes('/payments')) return 'Payments';
  if (path.includes('/attendance')) return 'Attendance';
  if (path === '/credit-notes') return 'Credit Notes';
  if (path.startsWith('/credit-notes/')) {
    const id = path.split('/')[2];
    return `Credit Note #${id}`;
  }
  // Default: capitalize first segment
  const segments = path.split('/').filter(Boolean);
  return segments[0]?.charAt(0).toUpperCase() + segments[0]?.slice(1) || 'Untitled';
}

export function TabProvider({
  children,
  getComponentForPath,
}: {
  children: React.ReactNode;
  getComponentForPath: (path: string) => React.ReactNode;
}) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [maxTabs, setMaxTabsState] = useState<number>(DEFAULT_MAX_TABS);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Track when we're navigating programmatically to avoid loops
  const skipNextLocationChange = useRef(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const storedSettings = localStorage.getItem(TAB_SETTINGS_KEY);
      if (storedSettings) {
        const { maxTabs: storedMaxTabs } = JSON.parse(storedSettings);
        setMaxTabsState(storedMaxTabs || DEFAULT_MAX_TABS);
      }
    } catch (error) {
      console.error('Failed to load tab settings:', error);
      localStorage.removeItem(TAB_SETTINGS_KEY);
    }
  }, []);

  // Save tabs metadata (without components) to localStorage whenever they change
  useEffect(() => {
    if (tabs.length > 0) {
      try {
        const tabsMetadata = tabs.map(({ component, ...rest }) => rest);
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabsMetadata));
      } catch (error) {
        console.error('Failed to save tabs to localStorage:', error);
      }
    } else {
      localStorage.removeItem(TABS_STORAGE_KEY);
    }
  }, [tabs]);

  // Clear tabs and navigate to dashboard on logout
  useEffect(() => {
    if (!isAuthenticated && tabs.length > 0) {
      setTabs([]);
      setActiveTabId(null);
      localStorage.removeItem(TABS_STORAGE_KEY);
      // Navigate to dashboard after clearing tabs
      skipNextLocationChange.current = true;
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, tabs.length, navigate]);

  // Find tab by path
  const findTabByPath = useCallback(
    (path: string): Tab | null => {
      return tabs.find((tab) => tab.path === path) || null;
    },
    [tabs]
  );

  // Check if path should be tabbed
  const isTabbed = useCallback((path: string): boolean => {
    return !isExcludedRoute(path);
  }, []);

  // Check if we can open more tabs
  const canOpenMoreTabs = useCallback((): boolean => {
    return tabs.length < maxTabs;
  }, [tabs.length, maxTabs]);

  // Get active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || null;

  // Open or switch to tab (SYNCHRONOUS, NO NAVIGATION)
  const openTab = useCallback(
    (path: string, component?: React.ReactNode) => {
      // Check if route should be tabbed
      if (!isTabbed(path)) {
        console.warn('Attempted to open excluded route in tab:', path);
        return;
      }

      // Check if tab already exists
      const existingTab = findTabByPath(path);
      if (existingTab) {
        // Switch to existing tab
        setActiveTabId(existingTab.id);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === existingTab.id ? { ...t, lastAccessedAt: Date.now() } : t
          )
        );
        // Update URL to reflect state (use navigate to update React Router context)
        skipNextLocationChange.current = true;
        navigate(path, { replace: true });
        return;
      }

      // Check max tabs limit
      if (!canOpenMoreTabs()) {
        notifications.show({
          title: 'Maximum Tabs Reached',
          message: `You can only have ${maxTabs} tabs open. Close a tab first.`,
          color: 'orange',
        });
        return;
      }

      // Use componentMapper if no component provided
      const tabComponent = component || getComponentForPath(path);

      // Create new tab
      const newTab: Tab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        path,
        title: generateTitleFromPath(path),
        component: tabComponent,
        hasUnsavedChanges: false,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      // Update URL to reflect state (use navigate to update React Router context)
      skipNextLocationChange.current = true;
      navigate(path, { replace: true });
    },
    [findTabByPath, isTabbed, canOpenMoreTabs, maxTabs, navigate]
  );

  // Close tab
  const closeTab = useCallback(
    async (tabId: string): Promise<boolean> => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return false;

      // Check for unsaved changes
      if (tab.hasUnsavedChanges) {
        return new Promise((resolve) => {
          modals.openConfirmModal({
            title: 'Unsaved Changes',
            children: `Tab "${tab.title}" has unsaved changes. Close anyway?`,
            labels: { confirm: 'Close Tab', cancel: 'Cancel' },
            confirmProps: { color: 'red' },
            onConfirm: () => {
              // Proceed with close
              const newTabs = tabs.filter((t) => t.id !== tabId);
              setTabs(newTabs);

              // Handle active tab change
              if (activeTabId === tabId) {
                if (newTabs.length === 0) {
                  // No tabs left - navigate to dashboard
                  setActiveTabId(null);
                  skipNextLocationChange.current = true;
                  navigate('/', { replace: true });
                } else {
                  // Switch to adjacent tab
                  const currentIndex = tabs.findIndex((t) => t.id === tabId);
                  const nextIndex = Math.max(0, currentIndex - 1);
                  const nextTab = newTabs[nextIndex];
                  if (nextTab) {
                    setActiveTabId(nextTab.id);
                    skipNextLocationChange.current = true;
                    navigate(nextTab.path, { replace: true });
                  }
                }
              }

              resolve(true);
            },
            onCancel: () => resolve(false),
          });
        });
      }

      // No unsaved changes, close immediately
      const newTabs = tabs.filter((t) => t.id !== tabId);
      setTabs(newTabs);

      // Handle active tab change
      if (activeTabId === tabId) {
        if (newTabs.length === 0) {
          // No tabs left - navigate to dashboard
          setActiveTabId(null);
          skipNextLocationChange.current = true;
          navigate('/', { replace: true });
        } else {
          const currentIndex = tabs.findIndex((t) => t.id === tabId);
          const nextIndex = Math.max(0, currentIndex - 1);
          const nextTab = newTabs[nextIndex];
          if (nextTab) {
            setActiveTabId(nextTab.id);
            skipNextLocationChange.current = true;
            navigate(nextTab.path, { replace: true });
          }
        }
      }

      return true;
    },
    [tabs, activeTabId, navigate]
  );

  // Switch to tab (INSTANT, NO NAVIGATION)
  const switchToTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      setActiveTabId(tabId);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId ? { ...t, lastAccessedAt: Date.now() } : t
        )
      );
      // Update URL to reflect state (use navigate to update React Router context)
      skipNextLocationChange.current = true;
      navigate(tab.path, { replace: true });
    },
    [tabs, navigate]
  );

  // Update tab title (accepts either tabId or path)
  const updateTabTitle = useCallback((tabIdOrPath: string, title: string) => {
    setTabs((prev) =>
      prev.map((tab) => {
        // Check if it's a tab ID or a path
        if (tab.id === tabIdOrPath || tab.path === tabIdOrPath) {
          return { ...tab, title };
        }
        return tab;
      })
    );
  }, []);

  // Mark tab as dirty
  const markTabDirty = useCallback((tabId: string, isDirty: boolean) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, hasUnsavedChanges: isDirty } : tab
      )
    );
  }, []);

  // Replace current tab's path and component (for same-tab navigation like next/prev invoice)
  const replaceCurrentTab = useCallback(
    (path: string) => {
      if (!activeTabId) return;

      // Generate new component for the path
      const component = getComponentForPath(path);
      const title = generateTitleFromPath(path);

      // Update the current tab with new path and component
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? { ...tab, path, component, title, lastAccessedAt: Date.now() }
            : tab
        )
      );

      // Update URL without triggering new tab creation
      // Use location state to reliably indicate this is a tab replace operation
      skipNextLocationChange.current = true;
      navigate(path, { replace: true, state: { tabReplace: true } });
    },
    [activeTabId, navigate]
  );

  // Keyboard navigation: close current tab
  const closeCurrentTab = useCallback(() => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  }, [activeTabId, closeTab]);

  // Keyboard navigation: next tab
  const nextTab = useCallback(() => {
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const nextIndex = (currentIndex + 1) % tabs.length;
    switchToTab(tabs[nextIndex].id);
  }, [tabs, activeTabId, switchToTab]);

  // Keyboard navigation: previous tab
  const previousTab = useCallback(() => {
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    switchToTab(tabs[prevIndex].id);
  }, [tabs, activeTabId, switchToTab]);

  // Keyboard navigation: select by index
  const selectTabByIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < tabs.length) {
        switchToTab(tabs[index].id);
      }
    },
    [tabs, switchToTab]
  );

  // Set max tabs
  const setMaxTabs = useCallback((max: number) => {
    setMaxTabsState(max);
    try {
      localStorage.setItem(TAB_SETTINGS_KEY, JSON.stringify({ maxTabs: max }));
      notifications.show({
        title: 'Settings Saved',
        message: 'Interface settings updated successfully.',
        color: 'green',
      });
    } catch (error) {
      console.error('Failed to save tab settings:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings.',
        color: 'red',
      });
    }
  }, []);

  // Navigation interceptor: automatically open tabs for direct navigate() calls
  useEffect(() => {
    const path = location.pathname;
    const state = location.state as { tabReplace?: boolean } | null;

    // Skip if we just navigated programmatically from tab operations
    // Check both the ref and the location state for reliability
    if (skipNextLocationChange.current || state?.tabReplace) {
      skipNextLocationChange.current = false;
      return;
    }

    // If navigating to a tabbed route, ensure it opens in a tab
    if (isTabbed(path)) {
      // First check if the active tab already has this path (from replaceCurrentTab)
      const activeTabHasPath = tabs.some(tab => tab.id === activeTabId && tab.path === path);
      if (activeTabHasPath) {
        // Tab was already updated by replaceCurrentTab, nothing to do
        return;
      }

      const existingTab = findTabByPath(path);
      if (!existingTab) {
        // Create component and open tab
        const component = getComponentForPath(path);
        // Don't set skip flag here - openTab will do it
        openTab(path, component);
      } else if (existingTab.id !== activeTabId) {
        // Switch to existing tab
        setActiveTabId(existingTab.id);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === existingTab.id ? { ...t, lastAccessedAt: Date.now() } : t
          )
        );
      }
    }
  }, [location.pathname, location.state, isTabbed, findTabByPath, activeTabId, openTab, tabs]);

  const value: TabContextValue = {
    tabs,
    activeTab,
    maxTabs,
    openTab,
    closeTab,
    switchToTab,
    replaceCurrentTab,
    updateTabTitle,
    markTabDirty,
    findTabByPath,
    isTabbed,
    canOpenMoreTabs,
    closeCurrentTab,
    nextTab,
    previousTab,
    selectTabByIndex,
    setMaxTabs,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export function useTabContext() {
  const context = useContext(TabContext);
  if (context === undefined) {
    throw new Error('useTabContext must be used within a TabProvider');
  }
  return context;
}
