import React, { useMemo } from 'react';
import { useNavigate, matchPath } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';

// Create a mock router context that provides params extracted from the path
function TabRouteProvider({ path, children }: { path: string; children: React.ReactNode }) {
  // Define route patterns that might have params
  const routePatterns = [
    '/invoices/:id',
    '/invoices/:id/edit',
    '/quotations/:id',
    '/quotations/:id/edit',
    '/inventory/:id',
    '/inventory/:id/edit',
    '/payments/:id',
    '/employees/:id',
    '/employees/:id/edit',
    '/employees/:id/permissions',
    '/clients/:id',
    '/clients/:id/edit',
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
    <div data-route-params={JSON.stringify(params)} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
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
