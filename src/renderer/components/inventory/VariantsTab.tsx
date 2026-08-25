import { useState, useMemo, useEffect, useCallback } from 'react';
import { Paper, Stack, Group, Text, Button, Badge, ActionIcon, Menu, NumberFormatter } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconEdit, IconTrash, IconDotsVertical } from '@tabler/icons-react';
import { DataTable, Column, ProductThumbnail, ImageGalleryModal, ImageUploader, CopyButton } from '../common';
import { MarkButton } from '../tray/MarkButton';
import { usePreloadThumbnails } from '../../hooks';

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  location: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
}

interface VariantsTabProps {
  variants: Variant[];
  loading: boolean;
  parentIsTaxable: boolean;
  onAddVariant: () => void;
  onEditVariant: (variant: Variant) => void;
  onDeleteVariant: (variantId: number) => void;
}

export function VariantsTab({ variants, loading, parentIsTaxable, onAddVariant, onEditVariant, onDeleteVariant }: VariantsTabProps) {
  // Gallery modal state
  const [galleryOpened, { open: openGallery, close: closeGallery }] = useDisclosure(false);
  const [uploaderOpened, { open: openUploader, close: closeUploader }] = useDisclosure(false);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string | null>(null);

  // Thumbnail preloading
  const { preload, getThumbnail } = usePreloadThumbnails();

  // Preload thumbnails when variants data changes
  useEffect(() => {
    if (variants.length > 0) {
      preload(variants.map(v => ({ sku: v.variantSku, isVariant: true })));
    }
  }, [variants, preload]);

  // Handlers for gallery modal
  const handleThumbnailClick = useCallback((variantSku: string) => {
    setSelectedVariantSku(variantSku);
    openGallery();
  }, [openGallery]);

  const handleUploadClick = useCallback(() => {
    closeGallery();
    openUploader();
  }, [closeGallery, openUploader]);

  const handleImagesChange = useCallback(() => {
    // Refresh thumbnails after image changes
    if (variants.length > 0) {
      preload(variants.map(v => ({ sku: v.variantSku, isVariant: true })));
    }
  }, [variants, preload]);

  const variantsColumns: Column<Variant>[] = useMemo(
    () => [
      {
        key: 'image',
        header: '',
        width: 50,
        render: (variant) => (
          <ProductThumbnail
            sku={variant.variantSku}
            isVariant={true}
            size={40}
            preloadedImage={getThumbnail(variant.variantSku, true)}
            onClick={() => handleThumbnailClick(variant.variantSku)}
          />
        ),
      },
      {
        key: 'variantSku',
        header: 'Variant Part Number',
        width: 180,
        render: (variant) => (
          <Group gap="xs">
            <Text fw={500}>{variant.variantSku}</Text>
            <CopyButton value={variant.variantSku} />
          </Group>
        ),
      },
      {
        key: 'variantName',
        header: 'Name',
        render: (variant) => variant.variantName || '-',
      },
      {
        key: 'location',
        header: 'Location',
        width: 120,
        render: (variant) => variant.location || '-',
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: 100,
        accessor: 'quantity',
      },
      {
        key: 'price',
        header: 'Price',
        width: 120,
        render: (variant) =>
          variant.price ? <NumberFormatter value={variant.price} prefix="$" thousandSeparator decimalScale={2} /> : '-',
      },
      {
        key: 'status',
        header: 'Status',
        width: 100,
        render: (variant) => (
          <Badge color={variant.isActive ? 'green' : 'gray'} variant="light" size="sm">
            {variant.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        key: 'mark',
        header: '',
        width: 48,
        render: (variant) => (
          <MarkButton
            mode="variant"
            item={{
              partNumber: variant.variantSku,
              description: variant.description ?? variant.variantName ?? '',
              unitPrice: Number(variant.price ?? 0) || 0,
              isTaxable: parentIsTaxable,
              isVariant: true,
              parentPartNumber: variant.parentSku,
            }}
          />
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: 80,
        render: (variant) => (
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => onEditVariant(variant)}>
                Edit
              </Menu.Item>
              <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => onDeleteVariant(variant.id)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
      },
    ],
    [onEditVariant, onDeleteVariant, getThumbnail, handleThumbnailClick, parentIsTaxable]
  );

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={500}>Product Variants</Text>
          <Button leftSection={<IconPlus size={16} />} size="sm" variant="light" onClick={onAddVariant}>
            Add Variant
          </Button>
        </Group>
        <DataTable
          columns={variantsColumns}
          data={variants}
          loading={loading}
          keyField="id"
          emptyMessage="No variants found"
          minWidth={600}
          stickyActionsColumn
        />
      </Stack>

      {/* Image Gallery Modal */}
      {selectedVariantSku && (
        <ImageGalleryModal
          opened={galleryOpened}
          onClose={closeGallery}
          sku={selectedVariantSku}
          isVariant={true}
          onUploadClick={handleUploadClick}
          onImagesChange={handleImagesChange}
        />
      )}

      {/* Image Uploader Modal */}
      {selectedVariantSku && (
        <ImageUploader
          opened={uploaderOpened}
          onClose={closeUploader}
          sku={selectedVariantSku}
          isVariant={true}
          onUploadComplete={() => {
            handleImagesChange();
            closeUploader();
            openGallery();
          }}
        />
      )}
    </Paper>
  );
}
