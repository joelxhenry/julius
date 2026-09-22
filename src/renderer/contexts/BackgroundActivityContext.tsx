import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Group, Loader, Paper, Text, Transition } from '@mantine/core';

interface BackgroundTask {
  id: string;
  label: string;
}

interface BackgroundActivityContextType {
  /** Register (or relabel) an in-progress background task. */
  start: (id: string, label: string) => void;
  /** Clear a background task once it finishes. */
  stop: (id: string) => void;
}

const BackgroundActivityContext = createContext<BackgroundActivityContextType | undefined>(undefined);

/**
 * A subtle, non-blocking indicator for long-running background work.
 *
 * Renders a small pill in the bottom-left corner instead of a prominent
 * notification toast, so background progress never covers the header, tabs, or
 * other crucial controls. The pill is click-through (`pointerEvents: none`) and
 * disappears as soon as no tasks are active.
 */
export function BackgroundActivityProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);

  const start = useCallback((id: string, label: string) => {
    setTasks((prev) => [...prev.filter((t) => t.id !== id), { id, label }]);
  }, []);

  const stop = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ start, stop }), [start, stop]);

  const active = tasks.length > 0;
  // Show the most recently started task; note when others are also running.
  const current = tasks[tasks.length - 1];
  const label = current
    ? tasks.length > 1
      ? `${current.label} (+${tasks.length - 1} more)`
      : current.label
    : '';

  return (
    <BackgroundActivityContext.Provider value={value}>
      {children}
      <Transition mounted={active} transition="fade" duration={200}>
        {(styles) => (
          <Paper
            radius="xl"
            withBorder
            shadow="sm"
            py={6}
            px="sm"
            style={{
              ...styles,
              position: 'fixed',
              bottom: 'var(--mantine-spacing-lg)',
              left: 'var(--mantine-spacing-lg)',
              zIndex: 300,
              pointerEvents: 'none',
              opacity: 0.9,
              maxWidth: 280,
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <Loader size="xs" />
              <Text size="xs" c="dimmed" lineClamp={1}>
                {label}
              </Text>
            </Group>
          </Paper>
        )}
      </Transition>
    </BackgroundActivityContext.Provider>
  );
}

export function useBackgroundActivity() {
  const context = useContext(BackgroundActivityContext);
  if (context === undefined) {
    throw new Error('useBackgroundActivity must be used within a BackgroundActivityProvider');
  }
  return context;
}
