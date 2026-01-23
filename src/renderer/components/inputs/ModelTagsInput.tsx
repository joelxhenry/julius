import { useState, useEffect, useRef } from 'react';
import { TagsInput, TagsInputProps } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../../shared/types/ipc';

interface ModelTagsInputProps extends Omit<TagsInputProps, 'data'> {
  debounceMs?: number;
  limit?: number;
}

export function ModelTagsInput({
  debounceMs = 300,
  limit = 20,
  ...props
}: ModelTagsInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load initial suggestions on mount
  useEffect(() => {
    loadSuggestions('');
  }, []);

  const loadSuggestions = async (search: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_DISTINCT_MODELS, {
        search,
        limit,
      });
      if (result.success && result.data) {
        setSuggestions(result.data);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Failed to load model suggestions:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedLoadSuggestions = useDebouncedCallback(loadSuggestions, debounceMs);

  const handleSearchChange = (search: string) => {
    debouncedLoadSuggestions(search);
  };

  return (
    <TagsInput
      label="Models"
      placeholder="Type and press Enter to add"
      data={suggestions}
      onSearchChange={handleSearchChange}
      clearable
      maxTags={10}
      {...props}
    />
  );
}
