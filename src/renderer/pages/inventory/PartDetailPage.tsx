import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Tabs,
  Text,
  LoadingOverlay,
  Badge,
  SimpleGrid,
  ActionIcon,
  Modal,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPackage,
  IconHistory,
  IconPlus,
  IconAdjustments,
} from '@tabler/icons-react';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParts, usePartVariants } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { PartVariantForm } from '../../components/forms/PartVariantForm';
import { StockAdjustmentModal } from '../../components/inventory/StockAdjustmentModal';
import type { Part, PartVariant } from '../../../main/database/schema';
import numeral from 'numeral';

// Simple cache for preloaded parts
const partCache = new Map<number, Part>();

interface PartDetailPageProps {
  id?: string;
}

export function PartDetailPage({ id: propId }: PartDetailPageProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = propId || paramId;
  const navigate = useNavigate();
  const { parts, getById } = useParts();
  const { variants: allVariants, create: createVariant, update: updateVariant } = usePartVariants();
  const { activeTabId, updateTab, setTabTitle, findTabByPath } = useTabManager();

  const [part, setPart] = useState<Part | null>(null);
  const [variants, setVariants] = useState<PartVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [variantModalOpened, setVariantModalOpened] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<PartVariant | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);
  const [stockAdjustmentOpened, setStockAdjustmentOpened] = useState(false);
  const [stockAdjustmentVariant, setStockAdjustmentVariant] = useState<PartVariant | null>(null);

  // Use ref to avoid infinite loops with findTabByPath in useEffect
  const findTabByPathRef = useRef(findTabByPath);
  findTabByPathRef.current = findTabByPath;

  // Find current index and adjacent parts
  const { currentIndex, prevPart, nextPart } = useMemo(() => {
    if (!id || parts.length === 0) {
      return { currentIndex: -1, prevPart: null, nextPart: null };
    }
    const idx = parts.findIndex((p) => p.id === parseInt(id));
    return {
      currentIndex: idx,
      prevPart: idx > 0 ? parts[idx - 1] : null,
      nextPart: idx < parts.length - 1 ? parts[idx + 1] : null,
    };
  }, [id, parts]);

  // Navigate to a different part within the same tab
  const navigateToPart = useCallback((partId: number, partName: string) => {
    const newPath = `/inventory/parts/${partId}`;
    if (activeTabId) {
      updateTab(activeTabId, newPath, partName, partId.toString());
    }
    // Reset loading state and load new part
    setLoading(true);
    setPart(null);
  }, [activeTabId, updateTab]);

  // Preload adjacent parts for faster navigation
  const preloadPart = useCallback(async (partId: number) => {
    if (partCache.has(partId)) return;
    try {
      const data = await getById(partId);
      if (data) {
        partCache.set(partId, data);
      }
    } catch {
      // Silently fail preloading
    }
  }, [getById]);

  useEffect(() => {
    const loadPart = async () => {
      if (!id) return;
      const partId = parseInt(id);

      try {
        // Check cache first
        const cached = partCache.get(partId);
        if (cached) {
          setPart(cached);
          setLoading(false);
          // Update tab title with part name
          if (cached.name) {
            const currentPath = `/inventory/parts/${id}`;
            const tab = findTabByPathRef.current(currentPath);
            if (tab) {
              setTabTitle(tab.id, cached.name);
            }
          }
        } else {
          const data = await getById(partId);
          setPart(data);
          // Cache the loaded part
          if (data) {
            partCache.set(partId, data);
          }
          // Update tab title with part name
          if (data?.name) {
            const currentPath = `/inventory/parts/${id}`;
            const tab = findTabByPathRef.current(currentPath);
            if (tab) {
              setTabTitle(tab.id, data.name);
            }
          }
          setLoading(false);
        }

        // Filter variants for this part
        const partVariants = allVariants.filter((v) => v.partId === partId);
        setVariants(partVariants);
      } catch (error) {
        console.error('Failed to load part:', error);
        setLoading(false);
      }
    };

    loadPart();
  }, [id, getById, allVariants, setTabTitle]);

  // Preload adjacent parts after current part loads
  useEffect(() => {
    if (!part || loading) return;

    if (prevPart) {
      preloadPart(prevPart.id);
    }
    if (nextPart) {
      preloadPart(nextPart.id);
    }
  }, [part, loading, prevPart, nextPart, preloadPart]);

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!part) {
    return (
      <Paper p="xl">
        <Text>Part not found</Text>
        <Button onClick={() => navigate('/inventory/parts')} mt="md">
          Back to Parts
        </Button>
      </Paper>
    );
  }

  const variantColumns: ColumnDef<PartVariant>[] = [
    {
      key: 'sku',
      title: 'SKU',
      sortable: true,
      width: 120,
      render: (value) => value || '-',
    },
    {
      key: 'name',
      title: 'Variant',
      sortable: true,
      render: (value) => value || '-',
    },
    {
      key: 'price',
      title: 'Price',
      sortable: true,
      render: (value) => numeral(parseFloat(value || '0')).format('$0,0.00'),
    },
    {
      key: 'stockQty',
      title: 'Stock',
      sortable: true,
    },
    {
      key: 'id',
      title: 'Status',
      render: (_value, row) => {
        const stock = Number(row.stockQty) || 0;
        const reorderLevel = Number(row.reorderLevel) || 0;

        if (stock === 0) {
          return (
            <Badge color="red" size="sm">
              Out of Stock
            </Badge>
          );
        }
        if (reorderLevel > 0 && stock <= reorderLevel) {
          return (
            <Badge color="yellow" size="sm">
              Low Stock
            </Badge>
          );
        }
        return (
          <Badge color="green" size="sm">
            In Stock
          </Badge>
        );
      },
    },
    {
      key: 'reorderLevel',
      title: 'Reorder Level',
      sortable: true,
    },
    {
      key: 'location',
      title: 'Location',
      render: (value) => value || '-',
    },
    {
      key: 'isGeneric',
      title: 'Type',
      render: (value) => (
        <Badge color={value ? 'orange' : 'blue'} size="sm" variant="light">
          {value ? 'Generic' : 'Original'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: '',
      width: 50,
      render: (_value, row) => (
        <Tooltip label="Adjust Stock">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setStockAdjustmentVariant(row);
              setStockAdjustmentOpened(true);
            }}
          >
            <IconAdjustments size={16} />
          </ActionIcon>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Group gap={4}>
            <Tooltip label={prevPart ? `Previous: ${prevPart.name}` : 'No previous part'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                disabled={!prevPart}
                onClick={() => prevPart && navigateToPart(prevPart.id, prevPart.name)}
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={nextPart ? `Next: ${nextPart.name}` : 'No next part'} position="bottom">
              <ActionIcon
                variant="subtle"
                size="lg"
                disabled={!nextPart}
                onClick={() => nextPart && navigateToPart(nextPart.id, nextPart.name)}
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <Title order={2}>{part.name}</Title>
          {parts.length > 0 && currentIndex >= 0 && (
            <Text size="sm" c="dimmed">
              {currentIndex + 1} of {parts.length}
            </Text>
          )}
        </Group>
        <Button leftSection={<IconEdit size={16} />} variant="light">
          Edit Part
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            SKU
          </Text>
          <Text fw={500}>{part.sku}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Category
          </Text>
          <Text fw={500}>{part.category || 'N/A'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Model
          </Text>
          <Text fw={500}>{part.model || 'N/A'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Unit
          </Text>
          <Text fw={500}>{part.unit || 'N/A'}</Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Cost
          </Text>
          <Text fw={500}>{numeral(parseFloat(part.cost || '0')).format('$0,0.00')}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Price
          </Text>
          <Text fw={500}>{numeral(parseFloat(part.price || '0')).format('$0,0.00')}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Wholesale Price
          </Text>
          <Text fw={500}>{numeral(parseFloat(part.wholesalePrice || '0')).format('$0,0.00')}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Margin
          </Text>
          <Text fw={500}>{part.margin ? `${part.margin}%` : 'N/A'}</Text>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Currency
          </Text>
          <Text fw={500}>{part.currency || 'JMD'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Taxable
          </Text>
          <Badge color={part.taxable ? 'green' : 'gray'} size="sm">
            {part.taxable ? 'Yes' : 'No'}
          </Badge>
        </Paper>
      </SimpleGrid>

      {part.description && (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Description
          </Text>
          <Text>{part.description}</Text>
        </Paper>
      )}

      <Tabs defaultValue="variants">
        <Tabs.List>
          <Tabs.Tab value="variants" leftSection={<IconPackage size={16} />}>
            Variants ({variants.length})
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="variants" pt="md">
          <Group justify="space-between" mb="md">
            <Text fw={500}>Part Variants</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={() => {
                setSelectedVariant(null);
                setVariantModalOpened(true);
              }}
            >
              Add Variant
            </Button>
          </Group>

          {variants.length === 0 ? (
            <Paper withBorder p="xl">
              <Stack align="center" gap="md">
                <IconPackage size={48} stroke={1.5} color="gray" />
                <Text c="dimmed">No variants for this part</Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setVariantModalOpened(true)}
                >
                  Add First Variant
                </Button>
              </Stack>
            </Paper>
          ) : (
            <DataTable
              data={variants}
              columns={variantColumns}
              onRowClick={(variant) => {
                setSelectedVariant(variant);
                setVariantModalOpened(true);
              }}
              keyboardNav
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Stock adjustment history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={variantModalOpened}
        onClose={() => {
          setVariantModalOpened(false);
          setSelectedVariant(null);
        }}
        title={selectedVariant ? 'Edit Variant' : 'Add Variant'}
        size="lg"
      >
        <PartVariantForm
          partId={parseInt(id!)}
          variant={selectedVariant}
          onSubmit={async (data) => {
            setSavingVariant(true);
            try {
              if (selectedVariant) {
                await updateVariant(selectedVariant.id, data);
              } else {
                await createVariant(data);
              }
              setVariantModalOpened(false);
              setSelectedVariant(null);

              // Reload variants
              const updated = allVariants.filter((v) => v.partId === parseInt(id!));
              setVariants(updated);
            } finally {
              setSavingVariant(false);
            }
          }}
          onCancel={() => {
            setVariantModalOpened(false);
            setSelectedVariant(null);
          }}
          loading={savingVariant}
        />
      </Modal>

      <StockAdjustmentModal
        opened={stockAdjustmentOpened}
        onClose={() => {
          setStockAdjustmentOpened(false);
          setStockAdjustmentVariant(null);
        }}
        variant={stockAdjustmentVariant}
      />
    </Stack>
  );
}
