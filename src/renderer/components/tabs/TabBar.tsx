import { Group, Button, ActionIcon, ScrollArea, Tooltip, Menu, Text } from '@mantine/core';
import { IconX, IconDots } from '@tabler/icons-react';
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
    <div
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-3)',
        backgroundColor: 'var(--mantine-color-gray-0)',
        minHeight: 36,
      }}
    >
      <ScrollArea type="never" offsetScrollbars={false}>
        <Group gap={0} wrap="nowrap" p={4} pr={40}>
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
      <div style={{ position: 'absolute', right: 4, top: 4 }}>
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm">
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => closeAllTabs()}>Close All Tabs</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
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
    <Menu shadow="md" width={180} trigger="contextMenu">
      <Menu.Target>
        <Tooltip label={tab.path} openDelay={500}>
          <Button
            variant={isActive ? 'filled' : 'subtle'}
            color={color}
            size="xs"
            onClick={onClick}
            onMouseDown={onMiddleClick}
            styles={{
              root: {
                borderRadius: '4px 4px 0 0',
                height: 28,
                paddingRight: 24,
                position: 'relative',
                fontWeight: isActive ? 600 : 400,
                maxWidth: 180,
                minWidth: 80,
              },
              label: {
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              },
            }}
          >
            {tab.isDirty && (
              <Text component="span" c="red" fw={700} mr={4}>
                •
              </Text>
            )}
            {tab.title}
            <ActionIcon
              size={16}
              variant="subtle"
              color={isActive ? 'white' : color}
              onClick={onClose}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
              }}
            >
              <IconX size={12} />
            </ActionIcon>
          </Button>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item onClick={onClose}>Close Tab</Menu.Item>
        <Menu.Item onClick={onCloseOthers}>Close Other Tabs</Menu.Item>
        <Menu.Divider />
        <Menu.Item disabled>
          <Text size="xs" c="dimmed">
            {tab.path}
          </Text>
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
