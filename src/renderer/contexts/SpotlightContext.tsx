import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../shared/types/ipc';

export interface SpotlightResult {
  id: number;
  type: 'invoice' | 'client' | 'inventory' | 'quotation';
  title: string;
  subtitle: string;
  status?: string;
  url: string;
}

interface SpotlightContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (query: string) => void;
  results: SpotlightResult[];
  isLoading: boolean;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  navigateToSelected: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

interface SpotlightProviderProps {
  children: React.ReactNode;
}

export function SpotlightProvider({ children }: SpotlightProviderProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setResults([]);
    setSelectedIndex(0);
  }, []);
  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const searchSpotlight = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SPOTLIGHT_SEARCH, {
        query: searchQuery,
        limit: 10,
      });

      if (result.success && result.data) {
        setResults(result.data);
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Spotlight search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback(searchSpotlight, 300);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0);
    if (newQuery.length >= 2) {
      setIsLoading(true);
    }
    debouncedSearch(newQuery);
  }, [debouncedSearch]);

  const navigateToSelected = useCallback(() => {
    if (results.length > 0 && selectedIndex >= 0 && selectedIndex < results.length) {
      const selected = results[selectedIndex];
      navigate(selected.url);
      close();
    }
  }, [results, selectedIndex, navigate, close]);

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
  }, [results.length]);

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
  }, [results.length]);

  // Global keyboard shortcuts for spotlight
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open spotlight with Ctrl+K or Alt+F
      if ((e.ctrlKey && e.key === 'k') || (e.altKey && e.key === 'f')) {
        e.preventDefault();
        toggle();
        return;
      }

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
        return;
      }

      // Navigate results when open
      if (isOpen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveDown();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          navigateToSelected();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, toggle, close, moveUp, moveDown, navigateToSelected]);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
      query,
      setQuery,
      results,
      isLoading,
      selectedIndex,
      setSelectedIndex,
      navigateToSelected,
      moveUp,
      moveDown,
    }),
    [isOpen, open, close, toggle, query, setQuery, results, isLoading, selectedIndex, navigateToSelected, moveUp, moveDown]
  );

  return (
    <SpotlightContext.Provider value={value}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context) {
    throw new Error('useSpotlight must be used within a SpotlightProvider');
  }
  return context;
}
