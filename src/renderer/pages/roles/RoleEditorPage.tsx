import { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Button,
  TextInput,
  Switch,
  Alert,
  Loader,
  Accordion,
  Badge,
  SimpleGrid,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconShield,
  IconShieldCheck,
  IconCheck,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import {
  PERMISSION_CATEGORIES,
  getPermissionsByCategory,
  PermissionCategory,
} from '../../../shared/constants/permissions';

// The super-admin toggle replaces the special ADMIN permission, so its category
// is hidden from the per-permission editor.
const EDITOR_CATEGORIES = PERMISSION_CATEGORIES.filter((c) => c !== 'Administration');

export function RoleEditorPage() {
  const navigate = useNavigate();
  const { id } = useTabParams<{ id?: string }>();
  const { replaceCurrentTab } = useTabContext();
  const isEditing = !!id && id !== 'new';

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSystem, setIsSystem] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const permissionsByCategory = useMemo(() => getPermissionsByCategory(), []);

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      setLoading(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_ROLE, { id: parseInt(id!, 10) });
        if (result.success && result.data) {
          setName(result.data.name);
          setDescription(result.data.description || '');
          setIsSuperAdmin(result.data.isSuperAdmin);
          setIsSystem(result.data.isSystem);
          setPermissions(result.data.permissions || {});
        } else {
          setError(result.error || 'Failed to load role');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditing]);

  const togglePermission = (code: string, enabled: boolean) => {
    setPermissions((prev) => ({ ...prev, [code]: enabled }));
  };

  const toggleCategory = (category: PermissionCategory, enabled: boolean) => {
    setPermissions((prev) => {
      const updated = { ...prev };
      permissionsByCategory[category].forEach((p) => {
        updated[p.code] = enabled;
      });
      return updated;
    });
  };

  const isCategoryEnabled = (category: PermissionCategory) =>
    permissionsByCategory[category].every((p) => permissions[p.code]);
  const getEnabledCount = (category: PermissionCategory) =>
    permissionsByCategory[category].filter((p) => permissions[p.code]).length;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        permissions,
        isSuperAdmin,
      };
      const result = isEditing
        ? await window.electron.invoke(IpcChannel.UPDATE_ROLE, { id: parseInt(id!, 10), data: payload })
        : await window.electron.invoke(IpcChannel.CREATE_ROLE, payload);

      if (result.success) {
        notifications.show({
          title: isEditing ? 'Role Updated' : 'Role Created',
          message: `${name.trim()} has been saved`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        replaceCurrentTab('/roles');
      } else {
        setError(result.error || 'Failed to save role');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading role...</Text>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="flex-start">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/roles')}>
            Back
          </Button>
          <Stack gap={2}>
            <Group gap="sm">
              <IconShield size={24} />
              <Title order={2}>{isEditing ? 'Edit Role' : 'New Role'}</Title>
            </Group>
            {isSystem && (
              <Badge size="xs" variant="light" color="gray">
                System role
              </Badge>
            )}
          </Stack>
        </Group>
        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={saving}>
          Save Role
        </Button>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Details */}
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <TextInput
            label="Role Name"
            placeholder="e.g. Cashier, Stock Clerk, Manager"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Description"
            placeholder="What this role is for"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <IconShieldCheck size={20} color="var(--mantine-color-orange-6)" />
              <Stack gap={0}>
                <Text fw={500} size="sm">
                  Super Admin (full access)
                </Text>
                <Text size="xs" c="dimmed">
                  Grants unrestricted access to every feature, ignoring the permissions below.
                </Text>
              </Stack>
            </Group>
            <Switch
              size="lg"
              checked={isSuperAdmin}
              onChange={(e) => setIsSuperAdmin(e.currentTarget.checked)}
            />
          </Group>
        </Stack>
      </Paper>

      {/* Permissions */}
      {isSuperAdmin ? (
        <Alert icon={<IconShieldCheck size={16} />} color="orange" variant="light">
          This role has full access. Individual permissions are not needed.
        </Alert>
      ) : (
        <Accordion multiple defaultValue={EDITOR_CATEGORIES.slice()} variant="separated">
          {EDITOR_CATEGORIES.map((category) => {
            const perms = permissionsByCategory[category];
            const enabledCount = getEnabledCount(category);
            const allEnabled = isCategoryEnabled(category);
            return (
              <Accordion.Item key={category} value={category}>
                <Accordion.Control>
                  <Group justify="space-between" wrap="nowrap" pr="md">
                    <Text fw={500}>{category}</Text>
                    <Badge color={allEnabled ? 'green' : enabledCount > 0 ? 'yellow' : 'gray'} variant="light" size="sm">
                      {enabledCount}/{perms.length}
                    </Badge>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <Group justify="space-between" py="xs">
                      <Text size="sm" c="dimmed">
                        Enable all {category.toLowerCase()} permissions
                      </Text>
                      <Switch checked={allEnabled} onChange={(e) => toggleCategory(category, e.currentTarget.checked)} />
                    </Group>
                    <Divider />
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      {perms.map((perm) => (
                        <Paper key={perm.code} p="sm" radius="md" withBorder>
                          <Group justify="space-between" wrap="nowrap">
                            <Stack gap={2}>
                              <Text size="sm" fw={500}>
                                {perm.label}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {perm.description}
                              </Text>
                            </Stack>
                            <Switch
                              checked={!!permissions[perm.code]}
                              onChange={(e) => togglePermission(perm.code, e.currentTarget.checked)}
                            />
                          </Group>
                        </Paper>
                      ))}
                    </SimpleGrid>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}

      <Group justify="flex-end">
        <Button variant="subtle" onClick={() => navigate('/roles')}>
          Cancel
        </Button>
        <Button leftSection={<IconDeviceFloppy size={16} />} onClick={handleSave} loading={saving}>
          Save Role
        </Button>
      </Group>
    </Stack>
  );
}
