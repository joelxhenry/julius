import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  SimpleGrid,
  Box,
  Divider,
  Skeleton,
  Center,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPhoto, IconUpload, IconPhotoPlus, IconStarFilled } from '@tabler/icons-react';
import { ImageGalleryModal, ImageUploader } from '../common';
import { useAllInventoryImages } from '../../hooks/useAllInventoryImages';
import { InventoryImage } from '../../hooks/useInventoryImages';
import { IpcChannel } from '../../../shared/types/ipc';

interface Inventory {
  id: number;
  sku: string;
  description1: string | null;
  description2: string | null;
}

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
}

interface GalleryTabProps {
  item: Inventory;
  variants: Variant[];
  onImagesChange?: () => void;
}

interface ImageSectionProps {
  title: string;
  subtitle?: string;
  sku: string;
  isVariant: boolean;
  images: InventoryImage[];
  onManageClick: () => void;
  onUploadClick: () => void;
}

// Component for individual thumbnail that loads its own image data
function ThumbnailImage({ image, onClick }: { image: InventoryImage; onClick: () => void }) {
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

   useEffect(() => {
    if (image.thumbnailPath) {
      window.electron.invoke(IpcChannel.GET_IMAGE_FILE, { relativePath: image.thumbnailPath })
        .then((result: { success: boolean; data?: string }) => {
          if (result.success && result.data) {
            setThumbnailData(result.data);
          }
          setIsLoading(false);
        })
        .catch(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [image.thumbnailPath]);

  return (
    <Box
      style={{
        position: 'relative',
        aspectRatio: '1',
        borderRadius: 'var(--mantine-radius-sm)',
        overflow: 'hidden',
        border: image.isPrimary
          ? '2px solid var(--mantine-color-blue-5)'
          : '1px solid var(--mantine-color-gray-3)',
        cursor: 'pointer',
        backgroundColor: 'var(--mantine-color-gray-1)',
      }}
      onClick={onClick}
    >
      {isLoading ? (
        <Skeleton style={{ width: '100%', height: '100%' }} />
      ) : thumbnailData ? (
        <img
          src={thumbnailData}
          alt={image.fileName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <Center style={{ width: '100%', height: '100%' }}>
          <IconPhoto size={24} color="var(--mantine-color-gray-5)" />
        </Center>
      )}
      {image.isPrimary && (
        <IconStarFilled
          size={16}
          color="var(--mantine-color-yellow-5)"
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
          }}
        />
      )}
    </Box>
  );
}

function ImageSection({
  title,
  subtitle,
  sku,
  isVariant,
  images,
  onManageClick,
  onUploadClick,
}: ImageSectionProps) {
  const imageCount = images.length;

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={2}>
            <Group gap="xs">
              <Text fw={500}>{title}</Text>
              <Badge size="sm" variant="light" color={imageCount > 0 ? 'blue' : 'gray'}>
                {imageCount} image{imageCount !== 1 ? 's' : ''}
              </Badge>
            </Group>
            {subtitle && (
              <Text size="xs" c="dimmed">
                SKU: {subtitle}
              </Text>
            )}
          </Stack>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconUpload size={14} />}
              onClick={onUploadClick}
            >
              Upload
            </Button>
            {imageCount > 0 && (
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconPhoto size={14} />}
                onClick={onManageClick}
              >
                Manage
              </Button>
            )}
          </Group>
        </Group>

        {imageCount > 0 ? (
          <SimpleGrid cols={{ base: 4, sm: 6, md: 8 }} spacing="xs">

            {images.map((image) => (
              <ThumbnailImage
                key={image.id}
                image={image}
                onClick={onManageClick}
              />
            ))}
            <Box
              style={{
                aspectRatio: '1',
                borderRadius: 'var(--mantine-radius-sm)',
                border: '2px dashed var(--mantine-color-gray-4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={onUploadClick}
            >
              <IconPhotoPlus size={24} color="var(--mantine-color-gray-5)" />
            </Box>
          </SimpleGrid>
        ) : (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconPhoto size={40} color="var(--mantine-color-gray-4)" />
              <Text size="sm" c="dimmed">
                No images yet
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconUpload size={14} />}
                onClick={onUploadClick}
              >
                Upload First Image
              </Button>
            </Stack>
          </Center>
        )}
      </Stack>
    </Paper>
  );
}

export function GalleryTab({ item, variants, onImagesChange }: GalleryTabProps) {
  // Gallery modal state
  const [galleryOpened, { open: openGallery, close: closeGallery }] = useDisclosure(false);
  const [uploaderOpened, { open: openUploader, close: closeUploader }] = useDisclosure(false);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [selectedIsVariant, setSelectedIsVariant] = useState<boolean>(false);

  // Get variant SKUs
  const variantSkus = useMemo(() => variants.map(v => v.variantSku), [variants]);

  // Load all images
  const {
    mainImages,
    variantImages,
    isLoading,
    error,
    refresh,
    getTotalImageCount,
  } = useAllInventoryImages({
    mainSku: item.sku,
    variantSkus,
    autoLoad: true,
  });

  // Handlers
  const handleOpenGallery = useCallback((sku: string, isVariant: boolean) => {
    setSelectedSku(sku);
    setSelectedIsVariant(isVariant);
    openGallery();
  }, [openGallery]);

  const handleOpenUploader = useCallback((sku: string, isVariant: boolean) => {
    setSelectedSku(sku);
    setSelectedIsVariant(isVariant);
    openUploader();
  }, [openUploader]);

  const handleUploadFromGallery = useCallback(() => {
    closeGallery();
    openUploader();
  }, [closeGallery, openUploader]);

  const handleImagesChange = useCallback(() => {
    refresh();
    onImagesChange?.();
  }, [refresh, onImagesChange]);

  const handleUploadComplete = useCallback(() => {
    handleImagesChange();
    closeUploader();
    openGallery();
  }, [handleImagesChange, closeUploader, openGallery]);

  // Sort variants by name
  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => {
      const nameA = a.variantName || a.variantSku;
      const nameB = b.variantName || b.variantSku;
      return nameA.localeCompare(nameB);
    });
  }, [variants]);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={200} radius="md" />
        <Skeleton height={200} radius="md" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="xs">
            <Text c="red">{error}</Text>
            <Button size="xs" variant="light" onClick={refresh}>
              Retry
            </Button>
          </Stack>
        </Center>
      </Paper>
    );
  }

  const totalImages = getTotalImageCount();

  return (
    <Stack gap="lg">
      {/* Summary */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={500}>All Product Images</Text>
          <Badge variant="light" color={totalImages > 0 ? 'blue' : 'gray'}>
            {totalImages} total
          </Badge>
        </Group>
      </Group>

      {/* Main Product Images */}
      <ImageSection
        title="Main Product"
        subtitle={item.sku}
        sku={item.sku}
        isVariant={false}
        images={mainImages}
        onManageClick={() => handleOpenGallery(item.sku, false)}
        onUploadClick={() => handleOpenUploader(item.sku, false)}
      />

      {/* Variant Images */}
      {sortedVariants.length > 0 && (
        <>
          <Divider label="Variant Images" labelPosition="center" />
          {sortedVariants.map(variant => (
            <ImageSection
              key={variant.id}
              title={variant.variantName || `Variant: ${variant.variantSku}`}
              subtitle={variant.variantSku}
              sku={variant.variantSku}
              isVariant={true}
              images={variantImages[variant.variantSku] || []}
              onManageClick={() => handleOpenGallery(variant.variantSku, true)}
              onUploadClick={() => handleOpenUploader(variant.variantSku, true)}
            />
          ))}
        </>
      )}

      {/* Empty state when no variants */}
      {sortedVariants.length === 0 && mainImages.length === 0 && (
        <Paper p="xl" radius="md" withBorder>
          <Center>
            <Stack align="center" gap="md">
              <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
              <Text c="dimmed">No images have been uploaded yet</Text>
              <Button
                leftSection={<IconUpload size={16} />}
                onClick={() => handleOpenUploader(item.sku, false)}
              >
                Upload Product Images
              </Button>
            </Stack>
          </Center>
        </Paper>
      )}

      {/* Image Gallery Modal */}
      {selectedSku && (
        <ImageGalleryModal
          opened={galleryOpened}
          onClose={closeGallery}
          sku={selectedSku}
          isVariant={selectedIsVariant}
          onUploadClick={handleUploadFromGallery}
          onImagesChange={handleImagesChange}
        />
      )}

      {/* Image Uploader Modal */}
      {selectedSku && (
        <ImageUploader
          opened={uploaderOpened}
          onClose={closeUploader}
          sku={selectedSku}
          isVariant={selectedIsVariant}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </Stack>
  );
}
