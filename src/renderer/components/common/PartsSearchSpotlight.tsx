import { useState, useEffect, useMemo } from 'react';
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
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconPackage, IconBox } from '@tabler/icons-react';
import { useParts, usePartVariants } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import type { Part, PartVariant } from '../../../main/database/schema';
import numeral from 'numeral';

interface PartsSearchSpotlightProps {
  opened: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: 'part' | 'variant';
  title: string;
  subtitle: string;
  sku: string;
  stock?: number;
  price?: string;
  partId?: number;
  partName?: string;
}

export function PartsSearchSpotlight({ opened, onClose }: PartsSearchSpotlightProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(query, 300);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { parts, loading: partsLoading } = useParts();
  const { variants, loading: variantsLoading } = usePartVariants();
  const { openTab } = useTabManager();

  const loading = partsLoading || variantsLoading;

  // Pre-build a lookup map for parts by ID (O(1) lookup instead of O(n))
  const partsMap = useMemo(() => {
    const map = new Map<number, Part>();
    for (const part of parts) {
      map.set(part.id, part);
    }
    return map;
  }, [parts]);

  // Build search results from parts and variants
  const results = useMemo<SearchResult[]>(() => {
    const trimmedQuery = debouncedQuery.trim();

    if (!trimmedQuery) {
      // Show recent/all items when no query
      const partResults: SearchResult[] = parts.slice(0, 5).map((part) => ({
        id: `part-${part.id}`,
        type: 'part',
        title: part.name,
        subtitle: part.category || 'Uncategorized',
        sku: part.sku,
        price: part.price,
      }));

      const variantResults: SearchResult[] = variants.slice(0, 5).map((variant) => {
        const parentPart = partsMap.get(variant.partId);
        return {
          id: `variant-${variant.id}`,
          type: 'variant',
          title: variant.name || variant.sku || 'Unnamed Variant',
          subtitle: parentPart?.name || 'Unknown Part',
          sku: variant.sku || '',
          stock: variant.stockQty,
          price: variant.price,
          partId: variant.partId,
          partName: parentPart?.name,
        };
      });

      return [...partResults, ...variantResults];
    }

    const lowerQuery = trimmedQuery.toLowerCase();
    const partResults: SearchResult[] = [];
    const variantResults: SearchResult[] = [];

    // Search parts - break early once we have enough results
    for (const part of parts) {
      if (partResults.length >= 10) break;

      if (
        part.name.toLowerCase().includes(lowerQuery) ||
        part.sku.toLowerCase().includes(lowerQuery) ||
        part.category?.toLowerCase().includes(lowerQuery)
      ) {
        partResults.push({
          id: `part-${part.id}`,
          type: 'part',
          title: part.name,
          subtitle: part.category || 'Uncategorized',
          sku: part.sku,
          price: part.price,
        });
      }
    }

    // Search variants - break early once we have enough results
    for (const variant of variants) {
      if (variantResults.length >= 10) break;

      const parentPart = partsMap.get(variant.partId);
      const parentName = parentPart?.name?.toLowerCase() || '';

      if (
        variant.name?.toLowerCase().includes(lowerQuery) ||
        variant.sku?.toLowerCase().includes(lowerQuery) ||
        variant.barcode?.toLowerCase().includes(lowerQuery) ||
        parentName.includes(lowerQuery)
      ) {
        variantResults.push({
          id: `variant-${variant.id}`,
          type: 'variant',
          title: variant.name || variant.sku || 'Unnamed Variant',
          subtitle: parentPart?.name || 'Unknown Part',
          sku: variant.sku || '',
          stock: variant.stockQty,
          price: variant.price,
          partId: variant.partId,
          partName: parentPart?.name,
        });
      }
    }

    return [...partResults, ...variantResults];
  }, [debouncedQuery, parts, variants, partsMap]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Reset query when modal opens
  useEffect(() => {
    if (opened) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [opened]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'part') {
      const partId = result.id.replace('part-', '');
      openTab({
        type: 'part-detail',
        path: `/inventory/parts/${partId}`,
        title: result.title,
        entityId: partId,
      });
    } else {
      // For variants, navigate to the parent part
      const partId = result.partId;
      if (partId) {
        openTab({
          type: 'part-detail',
          path: `/inventory/parts/${partId}`,
          title: result.partName || 'Part Details',
          entityId: partId.toString(),
        });
      }
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const getStockBadge = (stock?: number) => {
    if (stock === undefined) return null;
    if (stock === 0) {
      return (
        <Badge color="red" size="sm">
          Out of Stock
        </Badge>
      );
    }
    if (stock <= 5) {
      return (
        <Badge color="yellow" size="sm">
          Low: {stock}
        </Badge>
      );
    }
    return (
      <Badge color="green" size="sm">
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
          <Text fw={500}>Search Parts & Variants</Text>
        </Group>
      }
      size="lg"
      padding="md"
      centered
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search by name, SKU, barcode, or location..."
          leftSection={<IconSearch size={18} />}
          rightSection={
            loading ? (
              <Loader size="xs" />
            ) : (
              <Group gap={4}>
                <Kbd size="xs">↑</Kbd>
                <Kbd size="xs">↓</Kbd>
                <Kbd size="xs">Enter</Kbd>
              </Group>
            )
          }
          rightSectionWidth={100}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          data-autofocus
        />

        <ScrollArea h={400} offsetScrollbars>
          {results.length === 0 ? (
            <Center py="xl">
              <Text c="dimmed">
                {debouncedQuery ? 'No results found' : 'Start typing to search...'}
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
                      {result.type === 'part' ? (
                        <IconPackage size={20} stroke={1.5} color="var(--mantine-color-blue-6)" />
                      ) : (
                        <IconBox size={20} stroke={1.5} color="var(--mantine-color-orange-6)" />
                      )}
                      <div>
                        <Group gap="xs">
                          <Text size="sm" fw={500} lineClamp={1}>
                            {result.title}
                          </Text>
                          <Badge
                            size="xs"
                            variant="light"
                            color={result.type === 'part' ? 'blue' : 'orange'}
                          >
                            {result.type === 'part' ? 'Part' : 'Variant'}
                          </Badge>
                        </Group>
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            {result.subtitle}
                          </Text>
                          {result.sku && (
                            <Text size="xs" c="dimmed">
                              · SKU: {result.sku}
                            </Text>
                          )}
                        </Group>
                      </div>
                    </Group>
                    <Group gap="xs" wrap="nowrap">
                      {result.price && (
                        <Text size="sm" fw={500}>
                          {numeral(parseFloat(result.price)).format('$0,0.00')}
                        </Text>
                      )}
                      {getStockBadge(result.stock)}
                    </Group>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          )}
        </ScrollArea>

        <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
          <Text size="xs" c="dimmed">
            {results.length} result{results.length !== 1 ? 's' : ''}
          </Text>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Press
            </Text>
            <Kbd size="xs">Esc</Kbd>
            <Text size="xs" c="dimmed">
              to close
            </Text>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
