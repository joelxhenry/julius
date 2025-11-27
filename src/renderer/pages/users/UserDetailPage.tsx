import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Text,
  LoadingOverlay,
  Badge,
  SimpleGrid,
  Modal,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconKey } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useUsers } from '../../hooks';
import { UserForm } from '../../components/forms/UserForm';
import type { User } from '../../../main/database/schema';
import type { UserFormData } from '../../utils/schemas';
import { notifications } from '@mantine/notifications';

interface UserDetailPageProps {
  id?: string;
}

export function UserDetailPage({ id: propId }: UserDetailPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { getById, create, update } = useUsers();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [editModalOpened, setEditModalOpened] = useState(isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      if (isNew) return;

      try {
        setLoading(true);
        const data = await getById(parseInt(id!));
        setUser(data);
      } catch (error) {
        console.error('Failed to load user:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load user',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [id, isNew, getById]);

  const handleSave = async (data: UserFormData) => {
    setSaving(true);
    try {
      if (isNew) {
        const result = await create(data);
        navigate(`/users/${result.id}`);
      } else {
        await update(parseInt(id!), data);
        const updated = await getById(parseInt(id!));
        setUser(updated);
        setEditModalOpened(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!user && !isNew) {
    return (
      <Paper p="xl">
        <Text>User not found</Text>
        <Button onClick={() => navigate('/users')} mt="md">
          Back to Users
        </Button>
      </Paper>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/users')}
          >
            Back
          </Button>
          <Title order={2}>
            {isNew ? 'New User' : `${user?.firstName} ${user?.lastName}`}
          </Title>
          {!isNew && user && (
            <>
              {user.usingDefaultPin && (
                <Badge color="orange" size="lg">
                  Using Default PIN
                </Badge>
              )}
              {!user.active && (
                <Badge color="gray" size="lg">
                  Inactive
                </Badge>
              )}
            </>
          )}
        </Group>
        {!isNew && (
          <Group>
            <Button
              variant="light"
              leftSection={<IconKey size={16} />}
              onClick={() => {
                notifications.show({
                  title: 'Feature Coming Soon',
                  message: 'PIN reset functionality will be implemented',
                  color: 'blue',
                });
              }}
            >
              Reset PIN
            </Button>
            <Button leftSection={<IconEdit size={16} />} onClick={() => setEditModalOpened(true)}>
              Edit
            </Button>
          </Group>
        )}
      </Group>

      {!isNew && user && (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Username
              </Text>
              <Text fw={500}>{user.username}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Email
              </Text>
              <Text fw={500}>{user.email || 'N/A'}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Job Title
              </Text>
              <Text fw={500}>{user.title || 'N/A'}</Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Role
              </Text>
              <Text fw={500}>
                {
                  { 1: 'Admin', 2: 'Manager', 3: 'Cashier', 4: 'User' }[user.roleId || 4]
                }
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Department
              </Text>
              <Text fw={500}>{user.department || 'N/A'}</Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Phone
              </Text>
              <Text fw={500}>{user.phone || 'N/A'}</Text>
            </Paper>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                Start Date
              </Text>
              <Text fw={500}>
                {user.startDate ? new Date(user.startDate).toLocaleDateString() : 'N/A'}
              </Text>
            </Paper>
            <Paper withBorder p="md">
              <Text size="sm" c="dimmed" mb="xs">
                End Date
              </Text>
              <Text fw={500}>
                {user.endDate ? new Date(user.endDate).toLocaleDateString() : 'Active'}
              </Text>
            </Paper>
          </SimpleGrid>
        </>
      )}

      <Modal
        opened={editModalOpened}
        onClose={() => {
          if (isNew) {
            navigate('/users');
          } else {
            setEditModalOpened(false);
          }
        }}
        title={isNew ? 'Create User' : 'Edit User'}
        size="lg"
      >
        <UserForm
          user={user}
          onSubmit={handleSave}
          onCancel={() => {
            if (isNew) {
              navigate('/users');
            } else {
              setEditModalOpened(false);
            }
          }}
          loading={saving}
        />
      </Modal>
    </Stack>
  );
}
