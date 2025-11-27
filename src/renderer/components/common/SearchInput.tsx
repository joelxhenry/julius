import { TextInput, TextInputProps, ActionIcon } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useState } from 'react';

interface SearchInputProps extends Omit<TextInputProps, 'onChange'> {
  onSearch: (value: string) => void;
  debounce?: number;
}

export function SearchInput({ onSearch, debounce = 300, ...props }: SearchInputProps) {
  const [value, setValue] = useState('');

  const debouncedSearch = useDebouncedCallback((searchValue: string) => {
    onSearch(searchValue);
  }, debounce);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    onSearch('');
  };

  return (
    <TextInput
      leftSection={<IconSearch size={16} />}
      rightSection={
        value && (
          <ActionIcon variant="subtle" onClick={handleClear}>
            <IconX size={16} />
          </ActionIcon>
        )
      }
      value={value}
      onChange={handleChange}
      {...props}
    />
  );
}
