import React, { createContext, useContext } from 'react';

interface TabContextType {
  tabId: string;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

interface TabContextProviderProps {
  tabId: string;
  children: React.ReactNode;
}

export function TabContextProvider({ tabId, children }: TabContextProviderProps) {
  return <TabContext.Provider value={{ tabId }}>{children}</TabContext.Provider>;
}

export function useTabContext(): TabContextType {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTabContext must be used within a TabContextProvider');
  }
  return context;
}

// Optional hook that doesn't throw if used outside context
export function useOptionalTabContext(): TabContextType | undefined {
  return useContext(TabContext);
}
