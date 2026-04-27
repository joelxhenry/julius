import { Box, Group, ScrollArea, Text, Indicator, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTheme } from '../../contexts/ThemeContext';

interface TabItemProps {
  id: string;
  title: string;
  isActive: boolean;
  hasUnsavedChanges: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
}

function TabItem({ id, title, isActive, hasUnsavedChanges, onSelect, onClose }: TabItemProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(e);
    }
  };

  return (
    <div
      onMouseDown={handleMiddleClick}
      onClick={onSelect}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        maxWidth: '200px',
        minWidth: '120px',
        height: '40px',
        paddingLeft: 'var(--mantine-spacing-md)',
        paddingRight: 'var(--mantine-spacing-md)',
        paddingTop: 'var(--mantine-spacing-xs)',
        paddingBottom: 'var(--mantine-spacing-xs)',
        borderBottom: isActive
          ? '2px solid var(--mantine-color-blue-6)'
          : '2px solid transparent',
        backgroundColor: isActive
          ? isDark
            ? 'var(--mantine-color-dark-6)'
            : 'var(--mantine-color-gray-1)'
          : 'transparent',
        transition: 'all 150ms ease',
        borderTopLeftRadius: 'var(--mantine-radius-sm)',
        borderTopRightRadius: 'var(--mantine-radius-sm)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = isDark
            ? 'var(--mantine-color-dark-7)'
            : 'var(--mantine-color-gray-0)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {/* Dirty indicator */}
      {hasUnsavedChanges && (
        <Indicator
          inline
          size={6}
          color="yellow"
          position="middle-start"
        />
      )}

      {/* Tab title */}
      <Text
        size="sm"
        fw={isActive ? 600 : 500}
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={title}
      >
        {title}
      </Text>

      {/* Close button */}
      <ActionIcon
        size="sm"
        variant="subtle"
        color="gray"
        onClick={onClose}
        style={{
          flexShrink: 0,
        }}
        aria-label={`Close ${title}`}
      >
        <IconX size={14} />
      </ActionIcon>
    </div>
  );
}

export function TabBar() {
  const { tabs, activeTab, switchToTab, closeTab, isTabbed } = useTabContext();
  const { colorScheme } = useTheme();
  const location = useLocation();
  const isDark = colorScheme === 'dark';

  // Don't render if no tabs or if on a non-tabbed page
  if (tabs.length === 0 || !isTabbed(location.pathname)) {
    return null;
  }

  const handleTabSelect = (tabId: string) => {
    switchToTab(tabId);
  };

  const handleTabClose = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    await closeTab(tabId);
  };

  return (
    <Box
      style={{
        borderBottom: `1px solid var(--mantine-color-default-border)`,
        backgroundColor: isDark
          ? 'var(--mantine-color-dark-8)'
          : 'var(--mantine-color-gray-0)',
        transition: 'background-color 200ms ease, border-color 200ms ease',
      }}
    >
      <ScrollArea type="never" offsetScrollbars={false}>
        <Group gap={0} wrap="nowrap" px="xs">
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              id={tab.id}
              title={tab.title}
              isActive={activeTab?.id === tab.id}
              hasUnsavedChanges={tab.hasUnsavedChanges || false}
              onSelect={() => handleTabSelect(tab.id)}
              onClose={(e) => handleTabClose(e, tab.id)}
            />
          ))}
        </Group>
      </ScrollArea>
    </Box>
  );
}
