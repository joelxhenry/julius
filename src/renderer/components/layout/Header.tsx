import { Group, Title, Text, Menu, Avatar, ActionIcon, Tooltip } from '@mantine/core';
import { IconLogout, IconUser, IconSun, IconMoon } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export function Header() {
  const { user, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useTheme();

  return (
    <Group
      h="100%"
      px="md"
      justify="space-between"
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
      }}
    >
      <Group>
        <Title order={3} style={{ letterSpacing: '-0.025em' }}>
          Turbo Julius
        </Title>
        <Text size="sm" c="dimmed" visibleFrom="sm">
          Auto Parts Management
        </Text>
      </Group>

      <Group gap="sm">
        {/* Theme Toggle Button */}
        <Tooltip label={`Switch to ${colorScheme === 'light' ? 'dark' : 'light'} mode`} position="bottom">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={toggleColorScheme}
            aria-label="Toggle color scheme"
          >
            {colorScheme === 'light' ? (
              <IconMoon size={20} stroke={1.5} />
            ) : (
              <IconSun size={20} stroke={1.5} />
            )}
          </ActionIcon>
        </Tooltip>

        {user && (
          <Menu shadow="lg" width={220} position="bottom-end">
            <Menu.Target>
              <Tooltip label={`${user.firstName} ${user.lastName}`} position="bottom">
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  radius="xl"
                >
                  <Avatar
                    size="sm"
                    radius="xl"
                    color="blue"
                    variant="filled"
                  >
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </Avatar>
                </ActionIcon>
              </Tooltip>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Account</Menu.Label>
              <Menu.Item leftSection={<IconUser size={14} />}>
                Profile
              </Menu.Item>
              <Menu.Item
                leftSection={colorScheme === 'light' ? <IconMoon size={14} /> : <IconSun size={14} />}
                onClick={toggleColorScheme}
              >
                {colorScheme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={14} />}
                onClick={logout}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Group>
  );
}
