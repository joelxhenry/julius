import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import {
  Tab,
  TabType,
  TabManagerState,
  TabManagerContextType,
  OpenTabConfig,
  isListTabType,
  getTabTypeFromPath,
  getDefaultTabTitle,
  getEntityIdFromPath,
  MAX_TABS_WARNING,
} from '../types/tabs';

// Generate unique tab ID
function generateTabId(type: TabType, entityId: string | null): string {
  const uuid = crypto.randomUUID?.() || Math.random().toString(36).substring(2);
  return `${type}-${entityId || 'none'}-${uuid}`;
}

// Local storage key for tab persistence
const TABS_STORAGE_KEY = 'turbo-julius-tabs';

// Load tabs from localStorage
function loadPersistedTabs(): TabManagerState {
  try {
    const stored = localStorage.getItem(TABS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clear dirty flags on restore (data may be stale)
      const tabs = parsed.tabs.map((tab: Tab) => ({ ...tab, isDirty: false }));
      return {
        tabs,
        activeTabId: parsed.activeTabId,
      };
    }
  } catch (e) {
    console.error('Failed to load persisted tabs:', e);
  }

  // Default: start with Dashboard tab
  const dashboardTab: Tab = {
    id: generateTabId('dashboard', null),
    type: 'dashboard',
    entityId: null,
    path: '/',
    title: 'Dashboard',
    isDirty: false,
    createdAt: Date.now(),
  };

  return {
    tabs: [dashboardTab],
    activeTabId: dashboardTab.id,
  };
}

// Reducer action types
type TabAction =
  | { type: 'OPEN_TAB'; payload: Tab }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'ACTIVATE_TAB'; payload: string }
  | { type: 'SET_DIRTY'; payload: { tabId: string; isDirty: boolean } }
  | { type: 'SET_TITLE'; payload: { tabId: string; title: string } }
  | { type: 'UPDATE_TAB'; payload: { tabId: string; path: string; title: string; entityId: string | null } }
  | { type: 'RESTORE_TABS'; payload: TabManagerState };

function tabReducer(state: TabManagerState, action: TabAction): TabManagerState {
  switch (action.type) {
    case 'OPEN_TAB':
      return {
        ...state,
        tabs: [...state.tabs, action.payload],
        activeTabId: action.payload.id,
      };

    case 'CLOSE_TAB': {
      const index = state.tabs.findIndex((t) => t.id === action.payload);
      const newTabs = state.tabs.filter((t) => t.id !== action.payload);

      // Don't allow closing the last tab - keep at least one
      if (newTabs.length === 0) {
        return state;
      }

      let newActiveId = state.activeTabId;

      if (state.activeTabId === action.payload && newTabs.length > 0) {
        // Activate adjacent tab (prefer right, fallback left)
        const newIndex = Math.min(index, newTabs.length - 1);
        newActiveId = newTabs[newIndex]?.id ?? null;
      }

      return { ...state, tabs: newTabs, activeTabId: newActiveId };
    }

    case 'ACTIVATE_TAB':
      return { ...state, activeTabId: action.payload };

    case 'SET_DIRTY':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId ? { ...t, isDirty: action.payload.isDirty } : t
        ),
      };

    case 'SET_TITLE':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId ? { ...t, title: action.payload.title } : t
        ),
      };

    case 'UPDATE_TAB':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.payload.tabId
            ? { ...t, path: action.payload.path, title: action.payload.title, entityId: action.payload.entityId }
            : t
        ),
      };

    case 'RESTORE_TABS':
      return action.payload;

    default:
      return state;
  }
}

// Create context
const TabManagerContext = createContext<TabManagerContextType | undefined>(undefined);

// Provider component
export function TabManagerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(tabReducer, null, loadPersistedTabs);

  // Persist tabs to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        TABS_STORAGE_KEY,
        JSON.stringify({
          tabs: state.tabs,
          activeTabId: state.activeTabId,
        })
      );
    } catch (e) {
      console.error('Failed to persist tabs:', e);
    }
  }, [state.tabs, state.activeTabId]);

  // Open a new tab or activate existing one
  const openTab = useCallback(
    (config: OpenTabConfig, forceNew = false): string => {
      const { type, path, title, entityId } = config;

      // For list tabs, always reuse existing tab
      if (isListTabType(type) && !forceNew) {
        const existing = state.tabs.find((t) => t.type === type);
        if (existing) {
          dispatch({ type: 'ACTIVATE_TAB', payload: existing.id });
          return existing.id;
        }
      }

      // Check tab limit
      if (state.tabs.length >= MAX_TABS_WARNING) {
        notifications.show({
          title: 'Many tabs open',
          message: `You have ${state.tabs.length} tabs open. Consider closing some to improve performance.`,
          color: 'yellow',
        });
      }

      // Create new tab
      const newTab: Tab = {
        id: generateTabId(type, entityId ?? null),
        type,
        entityId: entityId ?? null,
        path,
        title,
        isDirty: false,
        createdAt: Date.now(),
      };

      dispatch({ type: 'OPEN_TAB', payload: newTab });
      return newTab.id;
    },
    [state.tabs]
  );

  // Close a tab
  const closeTab = useCallback(
    async (tabId: string, force = false): Promise<boolean> => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return false;

      // Don't allow closing the last tab
      if (state.tabs.length <= 1) {
        notifications.show({
          title: 'Cannot close',
          message: 'At least one tab must remain open',
          color: 'yellow',
        });
        return false;
      }

      // Check for unsaved changes
      if (tab.isDirty && !force) {
        // In a real implementation, you'd show a confirmation dialog
        // For now, we'll just warn and allow closing
        const confirmed = window.confirm(
          `"${tab.title}" has unsaved changes. Close anyway?`
        );
        if (!confirmed) return false;
      }

      dispatch({ type: 'CLOSE_TAB', payload: tabId });
      return true;
    },
    [state.tabs]
  );

  // Close all tabs except the specified one
  const closeOtherTabs = useCallback(
    async (tabId: string): Promise<void> => {
      const tabsToClose = state.tabs.filter((t) => t.id !== tabId);

      for (const tab of tabsToClose) {
        await closeTab(tab.id, false);
      }
    },
    [state.tabs, closeTab]
  );

  // Close all tabs
  const closeAllTabs = useCallback(async (): Promise<void> => {
    // Keep the first tab (usually dashboard)
    const tabsToClose = state.tabs.slice(1);

    for (const tab of tabsToClose) {
      await closeTab(tab.id, false);
    }

    // Activate the first tab
    if (state.tabs.length > 0) {
      dispatch({ type: 'ACTIVATE_TAB', payload: state.tabs[0].id });
    }
  }, [state.tabs, closeTab]);

  // Activate a tab
  const activateTab = useCallback((tabId: string): void => {
    dispatch({ type: 'ACTIVATE_TAB', payload: tabId });
  }, []);

  // Navigate to next tab
  const nextTab = useCallback((): void => {
    if (state.tabs.length <= 1) return;

    const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
    const nextIndex = (currentIndex + 1) % state.tabs.length;
    dispatch({ type: 'ACTIVATE_TAB', payload: state.tabs[nextIndex].id });
  }, [state.tabs, state.activeTabId]);

  // Navigate to previous tab
  const prevTab = useCallback((): void => {
    if (state.tabs.length <= 1) return;

    const currentIndex = state.tabs.findIndex((t) => t.id === state.activeTabId);
    const prevIndex = (currentIndex - 1 + state.tabs.length) % state.tabs.length;
    dispatch({ type: 'ACTIVATE_TAB', payload: state.tabs[prevIndex].id });
  }, [state.tabs, state.activeTabId]);

  // Set tab dirty state
  const setTabDirty = useCallback((tabId: string, isDirty: boolean): void => {
    dispatch({ type: 'SET_DIRTY', payload: { tabId, isDirty } });
  }, []);

  // Set tab title
  const setTabTitle = useCallback((tabId: string, title: string): void => {
    dispatch({ type: 'SET_TITLE', payload: { tabId, title } });
  }, []);

  // Update tab (path, title, entityId) - useful for in-tab navigation
  const updateTab = useCallback((tabId: string, path: string, title: string, entityId: string | null): void => {
    dispatch({ type: 'UPDATE_TAB', payload: { tabId, path, title, entityId } });
  }, []);

  // Find tab by path
  const findTabByPath = useCallback(
    (path: string): Tab | undefined => {
      return state.tabs.find((t) => t.path === path);
    },
    [state.tabs]
  );

  // Find tabs by type
  const findTabsByType = useCallback(
    (type: TabType): Tab[] => {
      return state.tabs.filter((t) => t.type === type);
    },
    [state.tabs]
  );

  // Get active tab
  const getActiveTab = useCallback((): Tab | undefined => {
    return state.tabs.find((t) => t.id === state.activeTabId);
  }, [state.tabs, state.activeTabId]);

  // Get tab count
  const getTabCount = useCallback((): number => {
    return state.tabs.length;
  }, [state.tabs]);

  const value: TabManagerContextType = {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    activateTab,
    nextTab,
    prevTab,
    setTabDirty,
    setTabTitle,
    updateTab,
    findTabByPath,
    findTabsByType,
    getActiveTab,
    getTabCount,
  };

  return <TabManagerContext.Provider value={value}>{children}</TabManagerContext.Provider>;
}

// Hook to use tab manager
export function useTabManager(): TabManagerContextType {
  const context = useContext(TabManagerContext);
  if (!context) {
    throw new Error('useTabManager must be used within a TabManagerProvider');
  }
  return context;
}

// Re-export helper functions for convenience
export { getTabTypeFromPath, getDefaultTabTitle, getEntityIdFromPath };
