import { useState, useCallback, useRef, useEffect } from 'react';
import { Select, PasswordInput, Loader, Stack, Group, Avatar, Text, UnstyledButton, Box } from '@mantine/core';
import { useDebouncedCallback, useMergedRef } from '@mantine/hooks';
import { IconUser, IconLock } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';
import { employeeDisplayName } from '../../utils/employeeName';

interface EmployeeOption {
  value: string;
  label: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
}

interface EmployeeCredentialFieldsProps {
  selectedUsername: string | null;
  onSelectUsername: (username: string | null) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  employeeLabel?: string;
  employeePlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  employeeInputRef?: React.Ref<HTMLInputElement>;
  /**
   * Display details for `selectedUsername` when it's pre-selected (e.g. the
   * signed-in user) before any search has populated the name/username map.
   */
  initialEmployee?: { username: string; firstName: string | null; lastName: string | null } | null;
}

function initialsFor(employee: { firstName: string | null; lastName: string | null; username: string }): string {
  const combined = `${employee.firstName?.[0] ?? ''}${employee.lastName?.[0] ?? ''}`.toUpperCase();
  return combined || employee.username.slice(0, 2).toUpperCase();
}

/**
 * Identifies an employee by searching their name or username, then collects
 * their password. Used wherever the app used to prompt for a PIN/access code
 * to identify or authorise an employee for an action.
 *
 * Guided two-step flow for fast keyboard use: typing + Enter picks the
 * employee (Mantine's searchable Select already selects the highlighted
 * match on Enter), focus then jumps straight to the password field. Pressing
 * Backspace in an empty password field jumps back to search.
 */
export function EmployeeCredentialFields({
  selectedUsername,
  onSelectUsername,
  password,
  onPasswordChange,
  disabled = false,
  error = false,
  employeeLabel = 'Employee',
  employeePlaceholder = 'Search by name or username...',
  passwordLabel = 'Password',
  passwordPlaceholder = 'Enter password',
  employeeInputRef,
  initialEmployee = null,
}: EmployeeCredentialFieldsProps) {
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const employeeMapRef = useRef<Map<string, EmployeeOption>>(new Map());
  const internalSelectRef = useRef<HTMLInputElement>(null);
  const selectRef = useMergedRef(internalSelectRef, employeeInputRef);
  const passwordRef = useRef<HTMLInputElement>(null);

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
          (employee: { username: string | null; firstName: string | null; lastName: string | null; id: number }) => ({
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

  // Focus the password field the moment an employee is picked, so keyboard
  // users never have to reach for the mouse or Tab manually.
  useEffect(() => {
    if (selectedUsername) {
      const t = setTimeout(() => passwordRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [selectedUsername]);

  const handleChangeEmployee = useCallback(() => {
    onSelectUsername(null);
    onPasswordChange('');
    setSearchValue('');
    const t = setTimeout(() => internalSelectRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [onSelectUsername, onPasswordChange]);

  const handlePasswordKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Backspace in an empty password field is a quick "go back" shortcut.
      if (e.key === 'Backspace' && password === '') {
        handleChangeEmployee();
      }
    },
    [password, handleChangeEmployee]
  );

  const nothingFoundMessage = loading
    ? 'Searching...'
    : searchValue.length < 2
      ? 'Type at least 2 characters'
      : 'No employees found';

  const selectedEmployee = selectedUsername
    ? employeeMapRef.current.get(selectedUsername) ??
      (initialEmployee?.username === selectedUsername ? initialEmployee : null)
    : null;

  return (
    <Stack gap="sm">
      {selectedUsername ? (
        <Box>
          <Text size="xs" fw={500} c="dimmed" mb={4}>
            {employeeLabel}
          </Text>
          <Group
            justify="space-between"
            wrap="nowrap"
            px="sm"
            py={6}
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <Group gap="sm" wrap="nowrap">
              <Avatar radius="xl" size="sm" color="blue">
                {selectedEmployee ? initialsFor(selectedEmployee) : '?'}
              </Avatar>
              <Box>
                <Text size="sm" fw={500} lh={1.2}>
                  {selectedEmployee ? employeeDisplayName(selectedEmployee) : selectedUsername}
                </Text>
                <Text size="xs" c="dimmed" lh={1.2}>
                  @{selectedUsername}
                </Text>
              </Box>
            </Group>
            <UnstyledButton
              onClick={handleChangeEmployee}
              disabled={disabled}
              c="blue"
              fz="xs"
              fw={500}
            >
              Change
            </UnstyledButton>
          </Group>
        </Box>
      ) : (
        <Select
          ref={selectRef}
          label={employeeLabel}
          placeholder={employeePlaceholder}
          leftSection={<IconUser size={16} />}
          value={selectedUsername}
          onChange={onSelectUsername}
          data={options}
          searchable
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          disabled={disabled}
          error={error}
          nothingFoundMessage={nothingFoundMessage}
          rightSection={loading ? <Loader size="xs" /> : undefined}
          maxDropdownHeight={280}
        />
      )}

      <PasswordInput
        ref={passwordRef}
        label={passwordLabel}
        placeholder={selectedUsername ? passwordPlaceholder : 'Select an employee first'}
        leftSection={<IconLock size={16} />}
        value={password}
        onChange={(e) => onPasswordChange(e.currentTarget.value)}
        onKeyDown={handlePasswordKeyDown}
        disabled={disabled || !selectedUsername}
        error={error}
      />
    </Stack>
  );
}
