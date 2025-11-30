import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { useKeyboardShortcuts, KeyboardShortcut, formatShortcut } from '../hooks/useKeyboardShortcuts';

interface ShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
}

interface KeyboardShortcutContextValue {
  registerShortcuts: (groupName: string, shortcuts: KeyboardShortcut[]) => void;
  unregisterShortcuts: (groupName: string) => void;
  getAllShortcuts: () => ShortcutGroup[];
  isHelpOpen: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextValue | null>(null);

interface KeyboardShortcutProviderProps {
  children: React.ReactNode;
}

export function KeyboardShortcutProvider({ children }: KeyboardShortcutProviderProps) {
  const [shortcutGroups, setShortcutGroups] = useState<Map<string, KeyboardShortcut[]>>(new Map());
  const [isHelpOpen, { open: openHelp, close: closeHelp }] = useDisclosure(false);

  const registerShortcuts = useCallback((groupName: string, shortcuts: KeyboardShortcut[]) => {
    setShortcutGroups((prev) => {
      const next = new Map(prev);
      next.set(groupName, shortcuts);
      return next;
    });
  }, []);

  const unregisterShortcuts = useCallback((groupName: string) => {
    setShortcutGroups((prev) => {
      const next = new Map(prev);
      next.delete(groupName);
      return next;
    });
  }, []);

  const getAllShortcuts = useCallback((): ShortcutGroup[] => {
    const groups: ShortcutGroup[] = [];
    shortcutGroups.forEach((shortcuts, name) => {
      groups.push({ name, shortcuts });
    });
    return groups;
  }, [shortcutGroups]);

  // Flatten all shortcuts for the global handler
  const allShortcuts = useMemo(() => {
    const shortcuts: KeyboardShortcut[] = [];
    shortcutGroups.forEach((groupShortcuts) => {
      shortcuts.push(...groupShortcuts);
    });

    // Add the help shortcut (? key)
    shortcuts.push({
      key: '?',
      shift: true,
      callback: () => {
        if (isHelpOpen) {
          closeHelp();
        } else {
          openHelp();
        }
      },
      description: 'Show keyboard shortcuts',
    });

    return shortcuts;
  }, [shortcutGroups, isHelpOpen, openHelp, closeHelp]);

  // Use the keyboard shortcuts hook
  useKeyboardShortcuts(allShortcuts);

  const value = useMemo(
    () => ({
      registerShortcuts,
      unregisterShortcuts,
      getAllShortcuts,
      isHelpOpen,
      openHelp,
      closeHelp,
    }),
    [registerShortcuts, unregisterShortcuts, getAllShortcuts, isHelpOpen, openHelp, closeHelp]
  );

  return (
    <KeyboardShortcutContext.Provider value={value}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
}

export function useKeyboardShortcutContext() {
  const context = useContext(KeyboardShortcutContext);
  if (!context) {
    throw new Error('useKeyboardShortcutContext must be used within a KeyboardShortcutProvider');
  }
  return context;
}

export { formatShortcut };
