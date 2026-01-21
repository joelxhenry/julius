import { useState, useCallback } from 'react';
import { useDebouncedCallback } from '@mantine/hooks';
import { IpcChannel } from '../../shared/types/ipc';

export interface Client {
  id: number;
  clNumber: string | null;
  clientName: string;
  address1: string | null;
  address2: string | null;
  phone: string | null;
  isTaxable: boolean;
  creditTerms: string | null;
  creditLimit: string | null;
  discountPct: string | null;
  isBadCredit: boolean;
}

export interface ClientOption {
  value: string;
  label: string;
  client: Client;
}

interface UseClientSearchOptions {
  onSelect?: (client: Client) => void;
  limit?: number;
}

export function useClientSearch(config: UseClientSearchOptions = {}) {
  const { onSelect, limit = 10 } = config;

  const [search, setSearch] = useState('');
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const searchClients = useDebouncedCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setClientOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_CLIENTS_FOR_SELECT, { query, limit });
      if (result.success && result.data) {
        setClientOptions(
          result.data.map((c: Client) => ({
            value: c.id.toString(),
            label: `${c.clientName}${c.clNumber ? ` (${c.clNumber})` : ''}`,
            client: c,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to search clients:', error);
    } finally {
      setIsSearching(false);
    }
  }, 300);

  const handleSelect = useCallback(
    (value: string) => {
      const option = clientOptions.find((o) => o.value === value);
      if (option) {
        setSelectedClient(option.client);
        setSearch(option.client.clientName);
        onSelect?.(option.client);
      }
    },
    [clientOptions, onSelect]
  );

  const reset = useCallback(() => {
    setSearch('');
    setClientOptions([]);
    setSelectedClient(null);
  }, []);

  const setClient = useCallback((client: Client | null) => {
    setSelectedClient(client);
    if (client) {
      setSearch(client.clientName);
    } else {
      setSearch('');
    }
  }, []);

  return {
    search,
    setSearch,
    options: clientOptions,
    isSearching,
    selectedClient,
    searchClients,
    handleSelect,
    reset,
    setClient,
  };
}
