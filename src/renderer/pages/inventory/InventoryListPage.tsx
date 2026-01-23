import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Button,
  Badge,
  ActionIcon,
  Text,
  NumberFormatter,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSearch,
  IconPlus,
  IconRefresh,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';
import { useDebouncedValue } from '@mantine/hooks';
import { DataTable, Column, ProductThumbnail, ImageGalleryModal, ImageUploader, CopyButton } from '../../components/common';
import { usePreloadThumbnails } from '../../hooks';
import { normalizeToArray } from '../../../shared/utils/arrayFields';

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  minLevel: number;
  isTaxable: boolean;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  margin: string | null;
  unit: string;
  category: string | null;
  model: string | null;
  wholesalePrice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PaginatedResult {
  data: Inventory[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function InventoryListPage() {
  const { replaceCurrentTab } = useTabContext();
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 500);

  // Gallery modal state
  const [galleryOpened, { open: openGallery, close: closeGallery }] = useDisclosure(false);
  const [uploaderOpened, { open: openUploader, close: closeUploader }] = useDisclosure(false);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  // Thumbnail preloading
  const { preload, getThumbnail } = usePreloadThumbnails();

  const pageSize = 20;

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_PAGINATED, {
        page,
        pageSize,
        search: debouncedSearch,
      });

      console.log('Inventory fetch result:', result);

      if (result.success && result.data) {
        const paginatedResult = result.data as PaginatedResult;
        setInventory(paginatedResult.data);
        setTotal(paginatedResult.total);
        setTotalPages(paginatedResult.totalPages);
      } else if (!result.success) {
        console.error('Inventory fetch failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Preload thumbnails when inventory data changes
  useEffect(() => {
    if (inventory.length > 0) {
      preload(inventory.map(item => ({ sku: item.sku, isVariant: false })));
    }
  }, [inventory, preload]);

  // Handlers for gallery modal
  const handleThumbnailClick = useCallback((sku: string) => {
    setSelectedSku(sku);
    openGallery();
  }, [openGallery]);

  const handleUploadClick = useCallback(() => {
    closeGallery();
    openUploader();
  }, [closeGallery, openUploader]);

  const handleImagesChange = useCallback(() => {
    // Refresh thumbnails after image changes
    if (inventory.length > 0) {
      preload(inventory.map(item => ({ sku: item.sku, isVariant: false })));
    }
  }, [inventory, preload]);

  const isLowStock = (item: Inventory) => {
    return item.quantity <= item.minLevel;
  };

  const columns: Column<Inventory>[] = useMemo(
    () => [
      {
        key: 'image',
        header: '',
        width: 100,
        render: (item) => (
          <ProductThumbnail
            sku={item.sku}
            isVariant={false}
            size={80}
            preloadedImage={getThumbnail(item.sku, false)}
            onClick={() => handleThumbnailClick(item.sku)}
          />
        ),
      },
      {
        key: 'sku',
        header: 'SKU',
        width: 280,
        render: (item) => (
          <Group gap="xs">
            <Text fw={500} size="sm">{item.sku}</Text>
            <CopyButton value={item.sku} />
            {isLowStock(item) && (
              <IconAlertTriangle size={14} color="var(--mantine-color-orange-6)" />
            )}
          </Group>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        render: (item) => (
          <Stack gap={0}>
            <Text size="sm" lineClamp={1}>{item.description1 || '-'}</Text>
            {item.description2 && (
              <Text size="xs" c="dimmed" lineClamp={1}>{item.description2}</Text>
            )}
          </Stack>
        ),
      },
      {
        key: 'category',
        header: 'Categories',
        width: 250,
        render: (item) => {
          const categories = normalizeToArray(item.category);
          return categories.length > 0 ? (
            <Group gap={6} wrap="wrap">
              {categories.map((cat, idx) => (
                <Badge key={idx} variant="filled" size="md" radius="sm">
                  {cat}
                </Badge>
              ))}
            </Group>
          ) : (
            <Text size="sm" c="dimmed">-</Text>
          );
        },
      },
      {
        key: 'quantity',
        header: 'Stock',
        width: 100,
        render: (item) => (
          <Badge
            color={isLowStock(item) ? 'orange' : 'green'}
            variant="light"
            size="sm"
          >
            {item.quantity} {item.unit}
          </Badge>
        ),
      },
      {
        key: 'price',
        header: 'Price',
        width: 100,
        render: (item) => (
          <Text size="sm" fw={500}>
            <NumberFormatter
              value={item.price}
              prefix="$"
              thousandSeparator
              decimalScale={2}
            />
          </Text>
        ),
      },
      {
        key: 'location',
        header: 'Location',
        width: 100,
        accessor: 'location',
      },
    ],
    [getThumbnail, handleThumbnailClick]
  );

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Title order={2}>Inventory</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => replaceCurrentTab('/inventory/new')}>
          Add Item
        </Button>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          {/* Filters */}
          <Group gap="md">
            <TextInput
              placeholder="Search by SKU, description, model..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <ActionIcon variant="subtle" onClick={fetchInventory} title="Refresh">
              <IconRefresh size={18} />
            </ActionIcon>
          </Group>

          {/* Results count */}
          <Text size="sm" c="dimmed">
            {total} item{total !== 1 ? 's' : ''} found
          </Text>

          {/* Table */}
          <DataTable
            columns={columns}
            data={inventory}
            loading={loading}
            keyField="id"
            onRowClick={(item) => replaceCurrentTab(`/inventory/${item.id}`)}
            emptyMessage="No inventory items found"
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            skeletonRows={5}
            minWidth={1000}
          />
        </Stack>
      </Paper>

      {/* Image Gallery Modal */}
      {selectedSku && (
        <ImageGalleryModal
          opened={galleryOpened}
          onClose={closeGallery}
          sku={selectedSku}
          isVariant={false}
          onUploadClick={handleUploadClick}
          onImagesChange={handleImagesChange}
        />
      )}

      {/* Image Uploader Modal */}
      {selectedSku && (
        <ImageUploader
          opened={uploaderOpened}
          onClose={closeUploader}
          sku={selectedSku}
          isVariant={false}
          onUploadComplete={() => {
            handleImagesChange();
            closeUploader();
            openGallery();
          }}
        />
      )}
    </Stack>
  );
}
