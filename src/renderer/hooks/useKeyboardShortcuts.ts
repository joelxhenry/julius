import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  callback: () => void;
  description: string;
}

/**
 * Hook for handling keyboard shortcuts
 * Automatically skips shortcuts when user is typing in input fields
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        // Allow Escape key to work even in inputs
        if (e.key !== 'Escape') {
          return;
        }
      }

      // Also skip if contentEditable
      if (target.isContentEditable) {
        if (e.key !== 'Escape') {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const altMatches = e.altKey === (shortcut.alt ?? false);
        const ctrlMatches = e.ctrlKey === (shortcut.ctrl ?? false);
        const shiftMatches = e.shiftKey === (shortcut.shift ?? false);

        if (keyMatches && altMatches && ctrlMatches && shiftMatches) {
          e.preventDefault();
          e.stopPropagation();
          shortcut.callback();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Format a shortcut for display (e.g., "Alt+I", "Ctrl+S")
 */
export function formatShortcut(shortcut: Omit<KeyboardShortcut, 'callback' | 'description'>): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}
