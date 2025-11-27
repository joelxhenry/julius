import { Group, Button, ActionIcon, ScrollArea, Tooltip, Menu, Text, Box } from '@mantine/core';
import { IconX, IconDots, IconPinned } from '@tabler/icons-react';
import { useTabManager } from '../../contexts/TabManagerContext';
import { Tab, TAB_COLORS } from '../../types/tabs';

export function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab, closeOtherTabs, closeAllTabs } =
    useTabManager();

  const handleTabClick = (tabId: string) => {
    activateTab(tabId);
  };

  const handleCloseClick = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  const handleMiddleClick = (e: React.MouseEvent, tabId: string) => {
    if (e.button === 1) {
      e.preventDefault();
      closeTab(tabId);
    }
  };

  return (
    <Box
      style={{
        minHeight: 40,
        position: 'relative',
        background: 'var(--mantine-color-body)',
        transition: 'background-color 200ms ease',
      }}
    >
      <ScrollArea type="hover" offsetScrollbars={false} scrollbarSize={6}>
        <Group gap={2} wrap="nowrap" px={8} py={6} pr={44}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClick={() => handleTabClick(tab.id)}
              onClose={(e) => handleCloseClick(e, tab.id)}
              onMiddleClick={(e) => handleMiddleClick(e, tab.id)}
              onCloseOthers={() => closeOtherTabs(tab.id)}
            />
          ))}
        </Group>
      </ScrollArea>

      {/* Tab actions menu */}
      <Box
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <Menu shadow="lg" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm" radius="md">
              <IconDots size={14} stroke={1.5} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => closeAllTabs()}>Close All Tabs</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>
    </Box>
  );
}

interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
  onMiddleClick: (e: React.MouseEvent) => void;
  onCloseOthers: () => void;
}

function TabButton({
  tab,
  isActive,
  onClick,
  onClose,
  onMiddleClick,
  onCloseOthers,
}: TabButtonProps) {
  const color = TAB_COLORS[tab.type] || 'gray';

  return (
    <Menu shadow="lg" width={200} trigger="contextMenu">
      <Menu.Target>
        <Tooltip label={tab.path} openDelay={500} position="bottom">
          <Button
            variant={isActive ? 'light' : 'subtle'}
            color={isActive ? color : 'gray'}
            size="xs"
            onClick={onClick}
            onMouseDown={onMiddleClick}
            styles={{
              root: {
                borderRadius: 'var(--mantine-radius-md)',
                height: 28,
                paddingRight: 26,
                paddingLeft: 12,
                position: 'relative',
                fontWeight: isActive ? 600 : 500,
                maxWidth: 200,
                minWidth: 80,
                transition: 'all 150ms ease',
                border: isActive
                  ? `1px solid var(--mantine-color-${color}-light)`
                  : '1px solid transparent',
                '&:hover': {
                  backgroundColor: isActive
                    ? undefined
                    : 'var(--mantine-color-gray-light-hover)',
                },
              },
              label: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.8125rem',
              },
            }}
          >
            {tab.isDirty && (
              <Box
                component="span"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-orange-6)',
                  marginRight: 6,
                  flexShrink: 0,
                }}
              />
            )}
            {tab.title}
            <ActionIcon
              size={18}
              variant="subtle"
              color="gray"
              radius="sm"
              onClick={onClose}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.6,
                transition: 'opacity 150ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
            >
              <IconX size={12} stroke={2} />
            </ActionIcon>
          </Button>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item onClick={onClose}>Close Tab</Menu.Item>
        <Menu.Item onClick={onCloseOthers}>Close Other Tabs</Menu.Item>
        <Menu.Divider />
        <Menu.Item disabled>
          <Text size="xs" c="dimmed" truncate>
            {tab.path}
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
