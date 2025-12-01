import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Stack,
  Title,
  Text,
  TextInput,
  Textarea,
  Button,
  Group,
  Badge,
  Divider,
  PasswordInput,
  Collapse,
  Alert,
  Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconPhone,
  IconMapPin,
  IconAlertCircle,
  IconCheck,
  IconLock,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';
import { useAuth, SafeEmployee } from '../../contexts/AuthContext';
import { IpcChannel } from '../../../shared/types/ipc';

interface ProfileFormValues {
  firstName: string;
  lastName: string;
  title: string;
  phone: string;
  address: string;
  emergencyContact: string;
}

interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    initialValues: {
      firstName: '',
      lastName: '',
      title: '',
      phone: '',
      address: '',
      emergencyContact: '',
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      newPassword: (value) => (value.length < 4 ? 'Password must be at least 4 characters' : null),
      confirmPassword: (value, values) => (value !== values.newPassword ? 'Passwords do not match' : null),
    },
  });

  // Load user data into form when component mounts or user changes
  useEffect(() => {
    if (user) {
      profileForm.setValues({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        title: user.title || '',
        phone: user.phone || '',
        address: user.address || '',
        emergencyContact: user.emergencyContact || '',
      });
    }
  }, [user]);

  const handleProfileSubmit = async (values: ProfileFormValues) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE, {
        id: user.id,
        data: {
          firstName: values.firstName || null,
          lastName: values.lastName || null,
          title: values.title || null,
          phone: values.phone || null,
          address: values.address || null,
          emergencyContact: values.emergencyContact || null,
        },
      });

      if (result.success && result.data) {
        // Update the auth context with the new user data
        updateUser(result.data);
        notifications.show({
          title: 'Profile Updated',
          message: 'Your profile has been updated successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
      } else if (!result.success) {
        notifications.show({
          title: 'Update Failed',
          message: result.error || 'Failed to update profile',
          color: 'red',
          icon: <IconAlertCircle size={16} />,
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        color: 'red',
        icon: <IconAlertCircle size={16} />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (values: PasswordFormValues) => {
    if (!user) return;

    setIsPasswordLoading(true);
    setPasswordError(null);

    try {
      // First verify the current password
      const authResult = await window.electron.invoke(IpcChannel.AUTHENTICATE_EMPLOYEE, {
        username: user.username,
        password: values.currentPassword,
      });

      if (!authResult.success) {
        setPasswordError('Current password is incorrect');
        setIsPasswordLoading(false);
        return;
      }

      // Update the password
      const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PASSWORD, {
        id: user.id,
        newPassword: values.newPassword,
      });

      if (result.success) {
        notifications.show({
          title: 'Password Changed',
          message: 'Your password has been changed successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        passwordForm.reset();
        setShowPasswordSection(false);
      } else {
        setPasswordError(result.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (!user) {
    return (
      <Box p="xl" ta="center">
        <Text c="dimmed">Please sign in to view your profile</Text>
      </Box>
    );
  }

  return (
    <Box p="xl" maw={800} mx="auto">
      <Stack gap="xl">
        {/* Header */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title order={2}>
                {user.firstName || user.lastName
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                  : 'My Profile'}
              </Title>
              <Group gap="sm">
                <Badge variant="light" color="blue">
                  {user.code}
                </Badge>
                {user.status && (
                  <Badge variant="light" color={user.status === 'active' ? 'green' : 'gray'}>
                    {user.status}
                  </Badge>
                )}
                {user.isSalesperson && (
                  <Badge variant="light" color="violet">
                    Salesperson
                  </Badge>
                )}
              </Group>
            </Stack>
            <IconUser size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
          </Group>
        </Card>

        {/* Profile Form */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <form onSubmit={profileForm.onSubmit(handleProfileSubmit)}>
            <Stack gap="md">
              <Title order={4}>Personal Information</Title>

              <Group grow>
                <TextInput
                  label="First Name"
                  placeholder="Enter first name"
                  {...profileForm.getInputProps('firstName')}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Enter last name"
                  {...profileForm.getInputProps('lastName')}
                />
              </Group>

              <TextInput label="Title" placeholder="Enter job title" {...profileForm.getInputProps('title')} />

              <Divider my="sm" />

              <Title order={4}>
                <Group gap="xs">
                  <IconPhone size={20} />
                  Contact Information
                </Group>
              </Title>

              <TextInput label="Phone" placeholder="Enter phone number" {...profileForm.getInputProps('phone')} />

              <Textarea
                label="Address"
                placeholder="Enter address"
                rows={3}
                leftSection={<IconMapPin size={16} />}
                {...profileForm.getInputProps('address')}
              />

              <TextInput
                label="Emergency Contact"
                placeholder="Enter emergency contact"
                {...profileForm.getInputProps('emergencyContact')}
              />

              <Divider my="sm" />

              {/* Read-only fields */}
              <Title order={4}>Account Information</Title>

              <Group grow>
                <TextInput label="Employee Code" value={user.code} disabled />
                <TextInput label="Username" value={user.username || 'Not set'} disabled />
              </Group>

              <Group grow>
                <TextInput label="Department" value={user.department || 'Not set'} disabled />
                <TextInput label="Start Date" value={user.startDate || 'Not set'} disabled />
              </Group>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => {
                    if (user) {
                      profileForm.setValues({
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        title: user.title || '',
                        phone: user.phone || '',
                        address: user.address || '',
                        emergencyContact: user.emergencyContact || '',
                      });
                    }
                  }}
                >
                  Reset
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? <Loader size="xs" color="white" /> : 'Save Changes'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        {/* Password Change Section */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group
              justify="space-between"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowPasswordSection(!showPasswordSection)}
            >
              <Title order={4}>
                <Group gap="xs">
                  <IconLock size={20} />
                  Change Password
                </Group>
              </Title>
              {showPasswordSection ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
            </Group>

            <Collapse in={showPasswordSection}>
              <form onSubmit={passwordForm.onSubmit(handlePasswordSubmit)}>
                <Stack gap="md" pt="sm">
                  {passwordError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                      {passwordError}
                    </Alert>
                  )}

                  <PasswordInput
                    label="Current Password"
                    placeholder="Enter current password"
                    {...passwordForm.getInputProps('currentPassword')}
                  />

                  <PasswordInput
                    label="New Password"
                    placeholder="Enter new password"
                    {...passwordForm.getInputProps('newPassword')}
                  />

                  <PasswordInput
                    label="Confirm New Password"
                    placeholder="Confirm new password"
                    {...passwordForm.getInputProps('confirmPassword')}
                  />

                  <Group justify="flex-end">
                    <Button
                      variant="subtle"
                      onClick={() => {
                        passwordForm.reset();
                        setPasswordError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      color="blue"
                      disabled={isPasswordLoading || !passwordForm.values.currentPassword}
                    >
                      {isPasswordLoading ? <Loader size="xs" color="white" /> : 'Change Password'}
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Collapse>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
