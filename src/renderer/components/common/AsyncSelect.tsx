import { Select, Loader } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useState, useEffect, useCallback, useRef } from 'react';

export interface AsyncSelectOption {
  value: string;
  label: string;
}

interface AsyncSelectProps {
  label?: string;
  placeholder?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onSearch: (query: string) => Promise<AsyncSelectOption[]>;
  disabled?: boolean;
  clearable?: boolean;
  required?: boolean;
  error?: string;
  description?: string;
  initialOptions?: AsyncSelectOption[];
  debounceMs?: number;
}

export function AsyncSelect({
  label,
  placeholder,
  value,
  onChange,
  onSearch,
  disabled = false,
  clearable = true,
  required = false,
  error,
  description,
  initialOptions = [],
  debounceMs = 300,
}: AsyncSelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, debounceMs);
  // Ensure initialOptions is always an array
  const safeInitialOptions = Array.isArray(initialOptions) ? initialOptions : [];
  const [options, setOptions] = useState<AsyncSelectOption[]>(safeInitialOptions);
  const [loading, setLoading] = useState(false);
  const initialLoadDone = useRef(false);

  // Update options when initialOptions changes (e.g., when loading existing data)
  useEffect(() => {
    const safeOpts = Array.isArray(initialOptions) ? initialOptions : [];
    if (safeOpts.length > 0) {
      setOptions((prev) => {
        // Merge initialOptions with existing options, avoiding duplicates
        const existingValues = new Set(prev.map((o) => o.value));
        const newOptions = safeOpts.filter((o) => !existingValues.has(o.value));
        return [...prev, ...newOptions];
      });
    }
  }, [initialOptions]);

  // Memoize the search function
  const loadOptions = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const results = await onSearch(query);
      // Ensure results is always an array
      setOptions(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('Error loading options:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [onSearch]);

  // Load initial options on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadOptions('');
    }
  }, [loadOptions]);

  // Load options when search changes
  useEffect(() => {
    if (initialLoadDone.current) {
      loadOptions(debouncedSearch);
    }
  }, [debouncedSearch, loadOptions]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchValue(query);
  }, []);

  // Ensure data is always an array for Mantine Select
  const selectData = Array.isArray(options) ? options : [];

  return (
    <Select
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      data={selectData}
      searchable
      clearable={clearable}
      disabled={disabled}
      required={required}
      error={error}
      description={description}
      onSearchChange={handleSearchChange}
      searchValue={searchValue}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={loading ? 'Loading...' : 'No results found'}
    />
  );
}
