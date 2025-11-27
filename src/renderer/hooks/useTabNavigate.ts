import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useTabManager,
  getTabTypeFromPath,
  getDefaultTabTitle,
  getEntityIdFromPath,
} from '../contexts/TabManagerContext';
import { isListTabType } from '../types/tabs';

interface TabNavigateOptions {
  newTab?: boolean; // Force open in new tab
  replace?: boolean; // Replace current tab (for redirects)
}

export function useTabNavigate() {
  const navigate = useNavigate();
  const { openTab, findTabByPath, activateTab, getActiveTab } = useTabManager();

  const tabNavigate = useCallback(
    (to: string, options?: TabNavigateOptions) => {
      const type = getTabTypeFromPath(to);
      const entityId = getEntityIdFromPath(to);
      const title = getDefaultTabTitle(to, type);

      // For list tabs, always reuse existing (single instance)
      if (isListTabType(type)) {
        openTab({ type, path: to, title, entityId });
        navigate(to, { replace: true });
        return;
      }

      // Check if we should open in new tab
      if (options?.newTab) {
        // Force new tab
        openTab({ type, path: to, title, entityId }, true);
        navigate(to, { replace: true });
        return;
      }

      // For detail pages, check if same path already exists
      const existingTab = findTabByPath(to);
      if (existingTab) {
        // Activate existing tab
        activateTab(existingTab.id);
        navigate(to, { replace: true });
        return;
      }

      // Open new tab
      openTab({ type, path: to, title, entityId });
      navigate(to, { replace: true });
    },
    [navigate, openTab, findTabByPath, activateTab]
  );

  return tabNavigate;
}

// Hook that can be used in click handlers to detect Ctrl+click
export function useTabNavigateWithEvent() {
  const tabNavigate = useTabNavigate();

  const navigateWithEvent = useCallback(
    (to: string, event?: React.MouseEvent) => {
      const newTab = event?.ctrlKey || event?.metaKey || event?.button === 1;
      tabNavigate(to, { newTab });
    },
    [tabNavigate]
  );

  return navigateWithEvent;
}
