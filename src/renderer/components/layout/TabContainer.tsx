import React, { useMemo, createContext, useContext } from 'react';
import { useNavigate, matchPath } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';

// Create context to provide the tab's specific path to child components
const TabPathContext = createContext<string | null>(null);

export function useTabPath() {
  return useContext(TabPathContext);
}

// Create a mock router context that provides params extracted from the path
function TabRouteProvider({ path, children }: { path: string; children: React.ReactNode }) {
  // Define route patterns that might have params
  // IMPORTANT: More specific patterns must come before generic ones
  const routePatterns = [
    '/invoices/form/:id',
    '/invoices/:id',
    '/quotations/:id/edit',
    '/quotations/:id',
    '/inventory/:id/edit',
    '/inventory/:id',
    '/payments/:id',
    '/employees/:id/edit',
    '/employees/:id/permissions',
    '/employees/:id',
    '/clients/:id/edit',
    '/clients/:id',
  ];

  // Try to match the path against known patterns to extract params
  const params = useMemo(() => {
    for (const pattern of routePatterns) {
      const match = matchPath(pattern, path);
      if (match) {
        return match.params;
      }
    }
    return {};
  }, [path]);

  // Inject params into URL for useParams to work
  // We'll use a hidden div with data attributes that components can read
  return (
    <TabPathContext.Provider value={path}>
      <div data-route-params={JSON.stringify(params)} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </TabPathContext.Provider>
  );
}

export function TabContainer() {
  const { tabs, activeTab } = useTabContext();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            display: tab.id === activeTab?.id ? 'flex' : 'none',
            flexDirection: 'column',
            height: '100%',
            overflow: 'auto',
            padding: 'var(--mantine-spacing-md)',
          }}
        >
          <TabRouteProvider path={tab.path}>
            {tab.component}
          </TabRouteProvider>
        </div>
      ))}
    </div>
  );
}
