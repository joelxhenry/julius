import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTabContext } from '../contexts/TabContext';
import { useNavigationMenu } from '../contexts/NavigationMenuContext';

type ModifierEvent = Pick<React.MouseEvent, 'ctrlKey' | 'metaKey'>;

/**
 * Browser-like navigation for in-content links (table rows, related-record
 * buttons): plain click navigates in the current tab, Ctrl/Cmd+click or the
 * right-click "Open in new tab" menu opens a new tab instead. Routes excluded
 * from tabbing (dashboard, settings, etc.) just navigate normally.
 */
export function useContentNavigation() {
  const { replaceCurrentTab, openTab, isTabbed } = useTabContext();
  const navigate = useNavigate();
  const { requestMenu } = useNavigationMenu();

  const go = useCallback(
    (path: string, event?: ModifierEvent, state?: Record<string, unknown>) => {
      if (!isTabbed(path)) {
        navigate(path, state ? { state } : undefined);
        return;
      }
      if (event?.ctrlKey || event?.metaKey) {
        openTab(path);
      } else {
        replaceCurrentTab(path, state);
      }
    },
    [isTabbed, navigate, openTab, replaceCurrentTab]
  );

  const bind = useCallback(
    (path: string | undefined, state?: Record<string, unknown>) => ({
      onClick: (e: React.MouseEvent) => {
        if (!path) return;
        e.stopPropagation();
        go(path, e, state);
      },
      onContextMenu: (e: React.MouseEvent) => {
        if (!path || !isTabbed(path)) return;
        e.preventDefault();
        e.stopPropagation();
        requestMenu(e.clientX, e.clientY, path);
      },
    }),
    [go, isTabbed, requestMenu]
  );

  return { go, bind };
}
