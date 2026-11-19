import { useState, useCallback, useRef } from 'react';
import { Stack, Select, PasswordInput, Button, Group, Text, Alert, Avatar, Box, Loader } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconUser, IconLock, IconCheck, IconAlertCircle, IconKey } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { employeeDisplayName } from '../../utils/employeeName';

interface EmployeeOption {
  id: number;
  value: string;
  label: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
}

function initialsFor(employee: { firstName: string | null; lastName: string | null; username: string }): string {
  const combined = `${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase();
  return combined || employee.username.slice(0, 2).toUpperCase();
}

/**
 * Administrative tool: search for any employee and set a new login password
 * for their account directly, without knowing their current one. Gated by
 * RESET_EMPLOYEE_PASSWORD at the Settings tab level.
 */
export function UserPasswordsTab() {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const employeeMapRef = useRef<Map<string, EmployeeOption>>(new Map());

  const form = useForm<{ newPassword: string; confirmPassword: string }>({
    initialValues: { newPassword: '', confirmPassword: '' },
    validate: {
      newPassword: (value) => (value.length < 4 ? 'Password must be at least 4 characters' : null),
      confirmPassword: (value, values) => (value !== values.newPassword ? 'Passwords do not match' : null),
    },
  });

  const searchEmployees = useCallback(async (query: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!query || query.length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    abortControllerRef.current = new AbortController();
    setLoading(true);

    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_EMPLOYEES_FOR_SELECT, {
        query,
        limit: 15,
        activeOnly: true,
        requireUsername: true,
      });

      if (result.success && result.data) {
        const newOptions: EmployeeOption[] = result.data.map(
          (employee: { id: number; username: string | null; firstName: string | null; lastName: string | null }) => ({
            id: employee.id,
            value: employee.username as string,
            label: `${employeeDisplayName(employee)} (${employee.username})`,
            firstName: employee.firstName,
            lastName: employee.lastName,
            username: employee.username as string,
          })
        );
        newOptions.forEach((opt) => employeeMapRef.current.set(opt.value, opt));
        setOptions(newOptions);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to search employees:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebouncedCallback(searchEmployees, 400);

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchValue(query);
      if (query.length >= 2) {
        setLoading(true);
      }
      debouncedSearch(query);
    },
    [debouncedSearch]
  );

  const handleSelect = useCallback(
    (username: string | null) => {
      setSelectedUsername(username);
      form.reset();
      setError(null);
    },
    [form]
  );

  const handleSubmit = useCallback(
    async (values: { newPassword: string; confirmPassword: string }) => {
      const employee = selectedUsername ? employeeMapRef.current.get(selectedUsername) : null;
      if (!employee) return;

      setSubmitting(true);
      setError(null);
      try {
        const result = await window.electron.invoke(IpcChannel.UPDATE_EMPLOYEE_PASSWORD, {
          id: employee.id,
          newPassword: values.newPassword,
        });
        if (result.success) {
          notifications.show({
            title: 'Password Changed',
            message: `A new password has been set for ${employeeDisplayName(employee)}`,
            color: 'green',
            icon: <IconCheck size={16} />,
          });
          form.reset();
          setSelectedUsername(null);
          setSearchValue('');
          setOptions([]);
        } else {
          setError(result.error || 'Failed to change password');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedUsername, form]
  );

  const nothingFoundMessage = loading
    ? 'Searching...'
    : searchValue.length < 2
      ? 'Type at least 2 characters'
      : 'No employees found';

  const selectedEmployee = selectedUsername ? employeeMapRef.current.get(selectedUsername) : null;

  return (
    <Stack gap="md" maw={480}>
      <Text size="sm" c="dimmed">
        Search for an employee and set a new login password for their account — no need to know their current one.
      </Text>

      <Select
        label="Employee"
        placeholder="Search by name or username..."
        leftSection={<IconUser size={16} />}
        value={selectedUsername}
        onChange={handleSelect}
        data={options}
        searchable
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        clearable
        nothingFoundMessage={nothingFoundMessage}
        rightSection={loading ? <Loader size="xs" /> : undefined}
        maxDropdownHeight={280}
      />

      {selectedEmployee && (
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <Group
              gap="sm"
              wrap="nowrap"
              px="sm"
              py={6}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <Avatar radius="xl" size="sm" color="blue">
                {initialsFor(selectedEmployee)}
              </Avatar>
              <Box>
                <Text size="sm" fw={500} lh={1.2}>
                  {employeeDisplayName(selectedEmployee)}
                </Text>
                <Text size="xs" c="dimmed" lh={1.2}>
                  @{selectedEmployee.username}
                </Text>
              </Box>
            </Group>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            <PasswordInput
              label="New Password"
              placeholder="Enter a password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('newPassword')}
            />
            <PasswordInput
              label="Confirm Password"
              placeholder="Re-enter the password"
              leftSection={<IconLock size={16} />}
              required
              {...form.getInputProps('confirmPassword')}
            />

            <Group justify="flex-end">
              <Button type="submit" leftSection={<IconKey size={16} />} loading={submitting}>
                Set Password
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Stack>
  );
}
