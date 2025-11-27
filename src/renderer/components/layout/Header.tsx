import { Group, Title, Text, Button, Menu, Avatar } from '@mantine/core';
import { IconLogout, IconUser, IconChevronDown } from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';

export function Header() {
  const { employee, logout } = useAuth();

  return (
    <Group h="100%" px="md" justify="space-between">
      <Group>
        <Title order={3}>Turbo Julius</Title>
        <Text size="sm" c="dimmed">
          Auto Parts Management
        </Text>
      </Group>

      {employee && (
        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button variant="subtle" rightSection={<IconChevronDown size={16} />}>
              <Group gap="xs">
                <Avatar size="sm" radius="xl" color="blue">
                  {employee.firstName?.[0]}{employee.lastName?.[0]}
                </Avatar>
                <div>
                  <Text size="sm" fw={500}>
                    {employee.firstName} {employee.lastName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {employee.title || 'Employee'}
                  </Text>
                </div>
              </Group>
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>Account</Menu.Label>
            <Menu.Item leftSection={<IconUser size={14} />}>
              Profile
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
  );
}
