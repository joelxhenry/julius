import React from 'react';
import { useTabContext } from '../../contexts/TabContext';

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
          {/* Use path as key to force re-render when navigating within same tab */}
          <React.Fragment key={tab.path}>{tab.component}</React.Fragment>
        </div>
      ))}
    </div>
  );
}
