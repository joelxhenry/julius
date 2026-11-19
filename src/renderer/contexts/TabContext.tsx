import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useAuth } from './AuthContext';
import { clearListState } from '../hooks/useListState';

// Tab interface
export interface Tab {
  id: string;
  path: string;
  title: string;
  hasUnsavedChanges?: boolean;
  component: React.ReactNode;
  createdAt: number;
  lastAccessedAt: number;
  // Stack of paths previously visited within this tab (most recent last),
  // so goBack() can return the tab to where it came from instead of a
  // hardcoded parent route.
  history: string[];
}

interface TabContextValue {
  tabs: Tab[];
  activeTab: Tab | null;
  maxTabs: number;

  // Navigation
  openTab: (path: string, component?: React.ReactNode) => void;
  closeTab: (tabId: string) => Promise<boolean>;
  switchToTab: (tabId: string) => void;
  replaceCurrentTab: (path: string, state?: Record<string, unknown>) => void;
  goBack: () => void;
  canGoBack: boolean;

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
  if (path.includes('/quotations/') && path.includes('/edit')) return 'Edit Quotation';
  if (path.includes('/quotations/')) return 'Quotation';
  if (path.includes('/inventory/new')) return 'New Item';
  if (path.includes('/inventory/manage/stock')) return 'Bulk Stock Update';
  if (path.includes('/inventory/manage/receive')) return 'Receive Parts';
  if (path.includes('/inventory/manage/mass-update')) return 'Mass Update';
  if (path.includes('/inventory/manage')) return 'Inventory Management';
  if (path.includes('/inventory/') && path.includes('/edit')) return 'Edit Item';
  if (path.includes('/employees/new')) return 'New Employee';
  if (path.includes('/employees/') && path.includes('/edit')) return 'Edit Employee';
  if (path.includes('/employees/') && path.includes('/permissions')) return 'Security Settings';
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
      clearListState();
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
        history: [],
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
      const doClose = () => {
        setTabs((prev) => {
          const newTabs = prev.filter((t) => t.id !== tabId);
          const currentIndex = prev.findIndex((t) => t.id === tabId);

          // Handle active tab change
          if (activeTabId === tabId) {
            if (newTabs.length === 0) {
              setActiveTabId(null);
              skipNextLocationChange.current = true;
              navigate('/', { replace: true });
            } else {
              const nextIndex = Math.max(0, currentIndex - 1);
              const nextTab = newTabs[nextIndex];
              if (nextTab) {
                setActiveTabId(nextTab.id);
                skipNextLocationChange.current = true;
                navigate(nextTab.path, { replace: true });
              }
            }
          }

          return newTabs;
        });
      };

      if (tab.hasUnsavedChanges) {
        return new Promise((resolve) => {
          modals.openConfirmModal({
            title: 'Unsaved Changes',
            children: `Tab "${tab.title}" has unsaved changes. Close anyway?`,
            labels: { confirm: 'Close Tab', cancel: 'Cancel' },
            confirmProps: { color: 'red' },
            onConfirm: () => {
              doClose();
              resolve(true);
            },
            onCancel: () => resolve(false),
          });
        });
      }

      doClose();
      return true;
    },
    [activeTabId, navigate]
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

  // Mark tab as dirty (accepts either tabId or path)
  const markTabDirty = useCallback((tabIdOrPath: string, isDirty: boolean) => {
    setTabs((prev) =>
      prev.map((tab) =>
        (tab.id === tabIdOrPath || tab.path === tabIdOrPath)
          ? { ...tab, hasUnsavedChanges: isDirty }
          : tab
      )
    );
  }, []);

  // Replace current tab's path and component (for same-tab navigation like next/prev invoice)
  const replaceCurrentTab = useCallback(
    (path: string, state?: Record<string, unknown>) => {
      // No tab to replace (e.g. first navigation after launch) — open one instead.
      if (!activeTabId) {
        openTab(path);
        return;
      }

      // Generate new component for the path
      const component = getComponentForPath(path);
      const title = generateTitleFromPath(path);

      // Update the current tab with new path and component, recording the
      // path we're leaving so goBack() can return to it later.
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                history: tab.path === path ? tab.history : [...tab.history, tab.path],
                path,
                component,
                title,
                lastAccessedAt: Date.now(),
              }
            : tab
        )
      );

      // Update URL without triggering new tab creation
      // Use location state to reliably indicate this is a tab replace operation
      skipNextLocationChange.current = true;
      navigate(path, { replace: true, state: { tabReplace: true, ...state } });
    },
    [activeTabId, navigate, openTab]
  );

  // Go back to the previously visited page within the active tab, popping
  // it off that tab's history stack. No-op if the tab has no history (e.g.
  // it was opened directly rather than navigated to from another page).
  const goBack = useCallback(() => {
    if (!activeTabId) return;

    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || tab.history.length === 0) return;

    const newHistory = [...tab.history];
    const previousPath = newHistory.pop() as string;
    const component = getComponentForPath(previousPath);
    const title = generateTitleFromPath(previousPath);

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, path: previousPath, component, title, history: newHistory, lastAccessedAt: Date.now() }
          : t
      )
    );

    skipNextLocationChange.current = true;
    navigate(previousPath, { replace: true, state: { tabReplace: true } });
  }, [activeTabId, tabs, navigate]);

  const canGoBack = Boolean(activeTab && activeTab.history.length > 0);

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

  // Navigation interceptor: automatically open tabs for direct navigate() calls.
  //
  // The handler reads tabs/activeTabId/etc. via a ref instead of the effect's
  // dependency array on purpose. React Router's navigate() resolves location
  // through its own (slower) transition, while replaceCurrentTab's setTabs
  // call commits as a plain, faster state update. If `tabs` were a dependency
  // here, the effect would also fire the instant replaceCurrentTab updates
  // tabs - before location has caught up to the new path - and that premature
  // run would consume the one-shot skip flag. By the time location actually
  // updates, the flag is already spent, so this effect would mistake the
  // (still-stale) old path for a fresh external navigation and open a stray
  // tab for it. Depending only on location.pathname/location.state ensures
  // this only runs in response to the URL genuinely changing.
  const handleLocationChange = (path: string, state: { tabReplace?: boolean } | null) => {
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
  };

  // Keep the latest handler in a ref (synced after every render, not during
  // it) so the effect that actually fires on navigation only needs to depend
  // on location.pathname/location.state, not on tabs/activeTabId/etc.
  const handleLocationChangeRef = useRef(handleLocationChange);
  useEffect(() => {
    handleLocationChangeRef.current = handleLocationChange;
  });

  useEffect(() => {
    handleLocationChangeRef.current(location.pathname, location.state as { tabReplace?: boolean } | null);
  }, [location.pathname, location.state]);

  const value: TabContextValue = {
    tabs,
    activeTab,
    maxTabs,
    openTab,
    closeTab,
    switchToTab,
    replaceCurrentTab,
    goBack,
    canGoBack,
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
