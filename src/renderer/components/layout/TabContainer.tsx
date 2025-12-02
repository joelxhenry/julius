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
          {tab.component}
        </div>
      ))}
    </div>
  );
}
