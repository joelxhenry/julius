import { useState } from 'react';
import { Group, Title, Text, Menu, Avatar, ActionIcon, Tooltip } from '@mantine/core';
import { IconLogout, IconUser, IconSun, IconMoon, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import logoUrl from '../../assets/logo.png';
import { useAuth, SafeEmployee } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSpotlight } from '../../contexts/SpotlightContext';
import { PasswordVerificationModal } from '../auth/PasswordVerificationModal';

export function Header() {
  const { user, logout, updateUser } = useAuth();
  const { colorScheme, toggleColorScheme } = useTheme();
  const { open: openSpotlight } = useSpotlight();
  const navigate = useNavigate();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const handleProfileClick = () => {
    setPasswordModalOpen(true);
  };

  const handlePasswordVerified = (employee: SafeEmployee) => {
    setPasswordModalOpen(false);
    updateUser(employee);
    navigate('/profile');
  };

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
        <img src={logoUrl} alt="" style={{ height: 32, width: 32, borderRadius: 4 }} />
        <Title order={3} style={{ letterSpacing: '-0.025em' }}>
          Turbo Julius
        </Title>
        <Text size="sm" c="dimmed" visibleFrom="sm">
          Auto Parts Management
        </Text>
      </Group>

      <Group gap="sm">
        {/* Quick Search Button */}
        <Tooltip label="Quick Search (Ctrl+K)" position="bottom">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={openSpotlight}
            aria-label="Quick search"
          >
            <IconSearch size={20} stroke={1.5} />
          </ActionIcon>
        </Tooltip>

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

        <Menu shadow="lg" width={220} position="bottom-end">
          <Menu.Target>
            <Tooltip label={user ? `${user.firstName} ${user.lastName}` : 'Sign In'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="xl"
              >
                <Avatar
                  size="sm"
                  radius="xl"
                  color={user ? 'blue' : 'gray'}
                  variant="filled"
                >
                  {user ? `${user.firstName?.[0]}${user.lastName?.[0]}` : <IconUser size={16} />}
                </Avatar>
              </ActionIcon>
            </Tooltip>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Account</Menu.Label>
            <Menu.Item leftSection={<IconUser size={14} />} onClick={handleProfileClick}>
              {user ? 'Profile' : 'Sign In'}
            </Menu.Item>
            <Menu.Item
              leftSection={colorScheme === 'light' ? <IconMoon size={14} /> : <IconSun size={14} />}
              onClick={toggleColorScheme}
            >
              {colorScheme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </Menu.Item>
            {user && (
              <>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconLogout size={14} />}
                  onClick={logout}
                >
                  Logout
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>

      <PasswordVerificationModal
        opened={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onVerified={handlePasswordVerified}
        title="Profile Access"
        description="Enter your username and password to access your profile"
      />
    </Group>
  );
}
