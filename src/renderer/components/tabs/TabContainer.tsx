import { Box } from '@mantine/core';
import { useTabManager } from '../../contexts/TabManagerContext';
import { TabPageResolver } from './TabPageResolver';

export function TabContainer() {
  const { tabs, activeTabId } = useTabManager();

  return (
    <Box style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {tabs.map((tab) => (
        <Box
          key={tab.id}
          style={{
            display: tab.id === activeTabId ? 'block' : 'none',
            height: '100%',
            overflow: 'auto',
          }}
          data-tab-id={tab.id}
        >
          <TabPageResolver path={tab.path} tabId={tab.id} />
        </Box>
      ))}
    </Box>
  );
}
