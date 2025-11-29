import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type ColorScheme = 'light' | 'dark';

interface ThemeContextType {
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  isTransitioning: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'turbo-julius-color-scheme';
const TRANSITION_DURATION = 300; // ms

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Fall back to system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);

  // Persist to localStorage whenever colorScheme changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, colorScheme);

    // Update document class for Tailwind dark mode
    if (colorScheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [colorScheme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setColorSchemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const transitionTheme = useCallback((newScheme: ColorScheme) => {
    if (newScheme === colorScheme) return;

    setIsTransitioning(true);

    // Small delay to let the overlay appear before changing theme
    setTimeout(() => {
      setColorSchemeState(newScheme);

      // End transition after the theme has been applied
      setTimeout(() => {
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
    }, 50);
  }, [colorScheme]);

  const toggleColorScheme = useCallback(() => {
    transitionTheme(colorScheme === 'light' ? 'dark' : 'light');
  }, [colorScheme, transitionTheme]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    transitionTheme(scheme);
  }, [transitionTheme]);

  return (
    <ThemeContext.Provider value={{ colorScheme, toggleColorScheme, setColorScheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
