import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  TextInput,
  Stack,
  Group,
  Text,
  Badge,
  ScrollArea,
  UnstyledButton,
  Kbd,
  Loader,
  Center,
  Tabs,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconSearch,
  IconPackage,
  IconBox,
  IconFileInvoice,
  IconUser,
  IconCash,
} from '@tabler/icons-react';
import { useParts, usePartVariants, useClients, useInvoices, usePayments } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Part, PartVariant, Client, Invoice, Payment } from '../../../main/database/schema';
import numeral from 'numeral';

interface SearchSpotlightProps {
  opened: boolean;
  onClose: () => void;
}

type EntityType = 'parts' | 'invoices' | 'clients' | 'payments';

interface SearchResult {
  id: string;
  entityType: EntityType;
  title: string;
  subtitle: string;
  metadata?: {
    status?: string;
    amount?: string;
    stock?: number;
    sku?: string;
  };
  // For navigation
  entityId: number;
  partId?: number; // For variants to navigate to parent part
}

const TABS: { value: EntityType; label: string; icon: React.ReactNode }[] = [
  { value: 'parts', label: 'Parts', icon: <IconPackage size={16} /> },
  { value: 'invoices', label: 'Invoices', icon: <IconFileInvoice size={16} /> },
  { value: 'clients', label: 'Clients', icon: <IconUser size={16} /> },
  { value: 'payments', label: 'Payments', icon: <IconCash size={16} /> },
];

export function SearchSpotlight({ opened, onClose }: SearchSpotlightProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<EntityType>('parts');
  const inputRef = useRef<HTMLInputElement>(null);

  // Hooks for data
  const { parts, loading: partsLoading } = useParts();
  const { variants, loading: variantsLoading } = usePartVariants();
  const { searchForSelect: searchClients } = useClients();
  const { fetchPaginated: fetchInvoices } = useInvoices();
  const { fetchPaginated: fetchPayments } = usePayments();
  const { openTab } = useTabManager();

  // State for async search results
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [invoiceResults, setInvoiceResults] = useState<Invoice[]>([]);
  const [paymentResults, setPaymentResults] = useState<Payment[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);

  // Pre-build a lookup map for parts by ID
  const partsMap = useMemo(() => {
    const map = new Map<number, Part>();
    for (const part of parts) {
      map.set(part.id, part);
    }
    return map;
  }, [parts]);

  // Search parts (client-side filter)
  const partsResults = useMemo<SearchResult[]>(() => {
    if (activeTab !== 'parts') return [];

    const trimmedQuery = debouncedQuery.trim().toLowerCase();
    const partResults: SearchResult[] = [];
    const variantResults: SearchResult[] = [];

    if (!trimmedQuery) {
      // Show recent/all items when no query
      for (const part of parts.slice(0, 5)) {
        partResults.push({
          id: `part-${part.id}`,
          entityType: 'parts',
          title: part.name,
          subtitle: part.category || 'Uncategorized',
          metadata: { sku: part.sku },
          entityId: part.id,
        });
      }
      for (const variant of variants.slice(0, 5)) {
        const parentPart = partsMap.get(variant.partId);
        variantResults.push({
          id: `variant-${variant.id}`,
          entityType: 'parts',
          title: variant.name || variant.sku || 'Unnamed Variant',
          subtitle: parentPart?.name || 'Unknown Part',
          metadata: { sku: variant.sku || '', stock: variant.stockQty },
          entityId: variant.id,
          partId: variant.partId,
        });
      }
      return [...partResults, ...variantResults];
    }

    // Search parts
    for (const part of parts) {
      if (partResults.length >= 10) break;
      if (
        part.name.toLowerCase().includes(trimmedQuery) ||
        part.sku.toLowerCase().includes(trimmedQuery) ||
        part.category?.toLowerCase().includes(trimmedQuery)
      ) {
        partResults.push({
          id: `part-${part.id}`,
          entityType: 'parts',
          title: part.name,
          subtitle: part.category || 'Uncategorized',
          metadata: { sku: part.sku },
          entityId: part.id,
        });
      }
    }

    // Search variants
    for (const variant of variants) {
      if (variantResults.length >= 10) break;
      const parentPart = partsMap.get(variant.partId);
      const parentName = parentPart?.name?.toLowerCase() || '';

      if (
        variant.name?.toLowerCase().includes(trimmedQuery) ||
        variant.sku?.toLowerCase().includes(trimmedQuery) ||
        variant.barcode?.toLowerCase().includes(trimmedQuery) ||
        parentName.includes(trimmedQuery)
      ) {
        variantResults.push({
          id: `variant-${variant.id}`,
          entityType: 'parts',
          title: variant.name || variant.sku || 'Unnamed Variant',
          subtitle: parentPart?.name || 'Unknown Part',
          metadata: { sku: variant.sku || '', stock: variant.stockQty },
          entityId: variant.id,
          partId: variant.partId,
        });
      }
    }

    return [...partResults, ...variantResults];
  }, [activeTab, debouncedQuery, parts, variants, partsMap]);

  // Async search for other entities
  useEffect(() => {
    const searchAsync = async () => {
      if (activeTab === 'parts') return;

      setAsyncLoading(true);
      try {
        const trimmedQuery = debouncedQuery.trim();

        if (activeTab === 'clients') {
          const results = await searchClients(trimmedQuery, 20);
          setClientResults(results);
        } else if (activeTab === 'invoices') {
          const result = await fetchInvoices({ search: trimmedQuery, pageSize: 20 });
          setInvoiceResults(result.data || []);
        } else if (activeTab === 'payments') {
          const result = await fetchPayments({ search: trimmedQuery, pageSize: 20 });
          setPaymentResults(result.data || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setAsyncLoading(false);
      }
    };

    searchAsync();
  }, [activeTab, debouncedQuery, searchClients, fetchInvoices, fetchPayments]);

  // Convert async results to SearchResult format
  const asyncResults = useMemo<SearchResult[]>(() => {
    if (activeTab === 'clients') {
      return clientResults.map((client) => ({
        id: `client-${client.id}`,
        entityType: 'clients' as EntityType,
        title: client.name,
        subtitle: [client.phone, client.email].filter(Boolean).join(' - ') || 'No contact info',
        metadata: { amount: client.creditLimit },
        entityId: client.id,
      }));
    }

    if (activeTab === 'invoices') {
      return invoiceResults.map((invoice) => ({
        id: `invoice-${invoice.id}`,
        entityType: 'invoices' as EntityType,
        title: `#${invoice.invoiceNumber}`,
        subtitle: invoice.clientName || 'Walk-in Customer',
        metadata: {
          status: invoice.status,
          amount: invoice.total,
        },
        entityId: invoice.id,
      }));
    }

    if (activeTab === 'payments') {
      return paymentResults.map((payment) => ({
        id: `payment-${payment.id}`,
        entityType: 'payments' as EntityType,
        title: `Payment #${payment.id}`,
        subtitle: `Invoice #${payment.invoiceId}`,
        metadata: {
          amount: payment.amount,
        },
        entityId: payment.id,
      }));
    }

    return [];
  }, [activeTab, clientResults, invoiceResults, paymentResults]);

  // Combined results based on active tab
  const results = useMemo(() => {
    if (activeTab === 'parts') return partsResults;
    return asyncResults;
  }, [activeTab, partsResults, asyncResults]);

  const loading = activeTab === 'parts' ? partsLoading || variantsLoading : asyncLoading;

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Reset query and focus input when modal opens
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after modal animation
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [opened]);

  // Handle result selection
  const handleSelect = useCallback(
    (result: SearchResult) => {
      switch (result.entityType) {
        case 'parts':
          // For variants, navigate to the parent part
          const partId = result.partId ?? result.entityId;
          openTab({
            type: 'part-detail',
            path: `/inventory/parts/${partId}`,
            title: result.title,
            entityId: partId.toString(),
          });
          break;

        case 'invoices':
          openTab({
            type: 'invoice-editor',
            path: `/invoices/${result.entityId}`,
            title: result.title,
            entityId: result.entityId.toString(),
          });
          break;

        case 'clients':
          openTab({
            type: 'client-detail',
            path: `/clients/${result.entityId}`,
            title: result.title,
            entityId: result.entityId.toString(),
          });
          break;

        case 'payments':
          // Navigate to the invoice for this payment
          const payment = paymentResults.find((p) => p.id === result.entityId);
          if (payment) {
            openTab({
              type: 'invoice-editor',
              path: `/invoices/${payment.invoiceId}`,
              title: `Invoice #${payment.invoiceId}`,
              entityId: payment.invoiceId.toString(),
            });
          }
          break;
      }
      onClose();
    },
    [openTab, onClose, paymentResults]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // Cycle through tabs
        const currentIndex = TABS.findIndex((t) => t.value === activeTab);
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + TABS.length) % TABS.length
          : (currentIndex + 1) % TABS.length;
        setActiveTab(TABS[nextIndex].value);
      }
    },
    [results, selectedIndex, activeTab, handleSelect]
  );

  // Render entity-specific result icon
  const getResultIcon = (result: SearchResult) => {
    switch (result.entityType) {
      case 'parts':
        return result.id.startsWith('variant-') ? (
          <IconBox size={20} stroke={1.5} color="var(--mantine-color-orange-6)" />
        ) : (
          <IconPackage size={20} stroke={1.5} color="var(--mantine-color-blue-6)" />
        );
      case 'invoices':
        return <IconFileInvoice size={20} stroke={1.5} color="var(--mantine-color-green-6)" />;
      case 'clients':
        return <IconUser size={20} stroke={1.5} color="var(--mantine-color-violet-6)" />;
      case 'payments':
        return <IconCash size={20} stroke={1.5} color="var(--mantine-color-teal-6)" />;
    }
  };

  // Render status badge for invoices
  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    const colorMap: Record<string, string> = {
      DRAFT: 'gray',
      ISSUED: 'blue',
      PARTIAL: 'yellow',
      PAID: 'green',
      CANCELLED: 'red',
      VOID: 'red',
    };
    return (
      <Badge size="xs" color={colorMap[status] || 'gray'}>
        {status}
      </Badge>
    );
  };

  // Render stock badge for parts
  const getStockBadge = (stock?: number) => {
    if (stock === undefined) return null;
    if (stock === 0) {
      return (
        <Badge color="red" size="xs">
          Out of Stock
        </Badge>
      );
    }
    if (stock <= 5) {
      return (
        <Badge color="yellow" size="xs">
          Low: {stock}
        </Badge>
      );
    }
    return (
      <Badge color="green" size="xs">
        {stock} in stock
      </Badge>
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconSearch size={20} />
          <Text fw={500}>Global Search</Text>
        </Group>
      }
      size="lg"
      padding="md"
      centered
    >
      <Stack gap="md">
        <Tabs value={activeTab} onChange={(v) => setActiveTab(v as EntityType)}>
          <Tabs.List>
            {TABS.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={tab.icon}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <TextInput
          ref={inputRef}
          placeholder={`Search ${activeTab}...`}
          leftSection={<IconSearch size={18} />}
          rightSection={
            loading ? (
              <Loader size="xs" />
            ) : (
              <Group gap={4}>
                <Kbd size="xs">Tab</Kbd>
                <Text size="xs" c="dimmed">
                  switch
                </Text>
              </Group>
            )
          }
          rightSectionWidth={90}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          data-autofocus
        />

        <ScrollArea h={350} offsetScrollbars>
          {results.length === 0 ? (
            <Center py="xl">
              <Text c="dimmed">
                {debouncedQuery ? 'No results found' : `Start typing to search ${activeTab}...`}
              </Text>
            </Center>
          ) : (
            <Stack gap={4}>
              {results.map((result, index) => (
                <UnstyledButton
                  key={result.id}
                  onClick={() => handleSelect(result)}
                  style={(theme) => ({
                    display: 'block',
                    width: '100%',
                    padding: theme.spacing.sm,
                    borderRadius: theme.radius.md,
                    backgroundColor:
                      index === selectedIndex
                        ? 'var(--mantine-color-blue-light)'
                        : 'transparent',
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-light)',
                    },
                  })}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      {getResultIcon(result)}
                      <div>
                        <Group gap="xs">
                          <Text size="sm" fw={500} lineClamp={1}>
                            {result.title}
                          </Text>
                          {result.metadata?.sku && (
                            <Badge size="xs" variant="light" color="gray">
                              {result.metadata.sku}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {result.subtitle}
                        </Text>
                      </div>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      {result.metadata?.amount && (
                        <Text size="sm" fw={500}>
                          {numeral(parseFloat(result.metadata.amount)).format('$0,0.00')}
                        </Text>
                      )}
                      {getStatusBadge(result.metadata?.status)}
                      {getStockBadge(result.metadata?.stock)}
                    </Group>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea>

        <Group
          justify="space-between"
          pt="xs"
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text size="xs" c="dimmed">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
          <Group gap="xs">
            <Kbd size="xs">Tab</Kbd>
            <Text size="xs" c="dimmed">
              switch tab
            </Text>
            <Text size="xs" c="dimmed">
              |
            </Text>
            <Kbd size="xs">Esc</Kbd>
            <Text size="xs" c="dimmed">
              close
            </Text>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
