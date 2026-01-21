import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Image,
  Text,
  ActionIcon,
  Button,
  Skeleton,
  Box,
  Badge,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
  IconPhoto,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { imageCache } from '../../utils/imageCache';

interface InventoryImage {
  id: number;
  sku: string;
  isVariant: boolean;
  filePath: string;
  thumbnailPath: string | null;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  isPrimary: boolean;
  sortOrder: number;
  uploadedAt: string;
  imageBase64?: string;
  thumbnailBase64?: string;
}

interface ImageGalleryModalProps {
  opened: boolean;
  onClose: () => void;
  sku: string;
  isVariant?: boolean;
  title?: string;
  onUploadClick?: () => void;
  onImagesChange?: () => void;
}

export function ImageGalleryModal({
  opened,
  onClose,
  sku,
  isVariant = false,
  title,
  onUploadClick,
  onImagesChange,
}: ImageGalleryModalProps) {
  const [images, setImages] = useState<InventoryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingPrimary, setIsSettingPrimary] = useState(false);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_IMAGES_WITH_DATA, {
        sku,
        isVariant,
      });

      if (result.success && result.data) {
        setImages(result.data);
        // Reset selection if needed
        if (selectedIndex >= result.data.length) {
          setSelectedIndex(Math.max(0, result.data.length - 1));
        }
      }
    } catch (error) {
      console.error('Failed to load images:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load images',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sku, isVariant, selectedIndex]);

  useEffect(() => {
    if (opened) {
      loadImages();
      setSelectedIndex(0);
    }
  }, [opened, loadImages]);

  const selectedImage = images[selectedIndex];

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  const handleSetPrimary = useCallback(async () => {
    if (!selectedImage) return;

    setIsSettingPrimary(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SET_PRIMARY_IMAGE, {
        imageId: selectedImage.id,
      });

      if (result.success) {
        // Invalidate cache for this SKU
        imageCache.invalidate(sku, isVariant);
        await loadImages();
        onImagesChange?.();
        notifications.show({
          title: 'Primary Image Set',
          message: 'This image is now the primary image',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to set primary image',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to set primary image',
        color: 'red',
      });
    } finally {
      setIsSettingPrimary(false);
    }
  }, [selectedImage, sku, isVariant, loadImages, onImagesChange]);

  const handleDelete = useCallback(async () => {
    if (!selectedImage) return;

    setIsDeleting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.DELETE_INVENTORY_IMAGE, {
        imageId: selectedImage.id,
      });

      if (result.success) {
        // Invalidate cache if deleting primary
        if (selectedImage.isPrimary) {
          imageCache.invalidate(sku, isVariant);
        }
        await loadImages();
        onImagesChange?.();
        notifications.show({
          title: 'Image Deleted',
          message: 'Image has been removed',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to delete image',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete image',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedImage, sku, isVariant, loadImages, onImagesChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    },
    [handlePrevious, handleNext]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPhoto size={20} />
          <Text fw={600}>{title || `Gallery: ${sku}`}</Text>
          {images.length > 0 && (
            <Badge size="sm" variant="light">
              {images.length} {images.length === 1 ? 'image' : 'images'}
            </Badge>
          )}
        </Group>
      }
      size="lg"
      centered
      onKeyDown={handleKeyDown}
    >
      <Stack gap="md">
        {isLoading ? (
          <Skeleton height={400} />
        ) : images.length === 0 ? (
          <Stack align="center" py="xl" gap="md">
            <IconPhoto size={64} color="var(--mantine-color-gray-5)" />
            <Text c="dimmed">No images for this item</Text>
            {onUploadClick && (
              <Button
                leftSection={<IconUpload size={16} />}
                variant="light"
                onClick={onUploadClick}
              >
                Upload Image
              </Button>
            )}
          </Stack>
        ) : (
          <>
            {/* Main Image Display */}
            <Box
              style={{
                position: 'relative',
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: 'var(--mantine-radius-md)',
                overflow: 'hidden',
              }}
            >
              {selectedImage?.isPrimary && (
                <Badge
                  color="yellow"
                  variant="filled"
                  leftSection={<IconStarFilled size={12} />}
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 10,
                  }}
                >
                  Primary
                </Badge>
              )}

              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 400,
                  padding: 16,
                }}
              >
                {selectedImage?.imageBase64 ? (
                  <Image
                    src={selectedImage.imageBase64}
                    alt={selectedImage.fileName}
                    fit="contain"
                    mah={400}
                  />
                ) : (
                  <Skeleton height={400} width="100%" />
                )}
              </Box>

              {/* Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <ActionIcon
                    variant="filled"
                    color="dark"
                    size="lg"
                    radius="xl"
                    style={{
                      position: 'absolute',
                      left: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      opacity: 0.8,
                    }}
                    onClick={handlePrevious}
                  >
                    <IconChevronLeft size={20} />
                  </ActionIcon>
                  <ActionIcon
                    variant="filled"
                    color="dark"
                    size="lg"
                    radius="xl"
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      opacity: 0.8,
                    }}
                    onClick={handleNext}
                  >
                    <IconChevronRight size={20} />
                  </ActionIcon>
                </>
              )}
            </Box>

            {/* Thumbnail Strip */}
            {images.length > 1 && (
              <Group gap="xs" justify="center" wrap="wrap">
                {images.map((image, index) => (
                  <UnstyledButton
                    key={image.id}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <Box
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 'var(--mantine-radius-sm)',
                        overflow: 'hidden',
                        border:
                          index === selectedIndex
                            ? '2px solid var(--mantine-color-blue-6)'
                            : '2px solid transparent',
                        position: 'relative',
                      }}
                    >
                      {image.thumbnailBase64 ? (
                        <Image
                          src={image.thumbnailBase64}
                          alt={`Thumbnail ${index + 1}`}
                          width={60}
                          height={60}
                          fit="cover"
                        />
                      ) : (
                        <Skeleton width={60} height={60} />
                      )}
                      {image.isPrimary && (
                        <IconStarFilled
                          size={14}
                          color="var(--mantine-color-yellow-5)"
                          style={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                          }}
                        />
                      )}
                    </Box>
                  </UnstyledButton>
                ))}
              </Group>
            )}

            {/* Image Info */}
            {selectedImage && (
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  {selectedImage.fileName}
                  {selectedImage.fileSize && (
                    <> ({(selectedImage.fileSize / 1024).toFixed(1)} KB)</>
                  )}
                </Text>
                <Text size="sm" c="dimmed">
                  {selectedIndex + 1} of {images.length}
                </Text>
              </Group>
            )}

            {/* Action Buttons */}
            <Group justify="space-between">
              <Group gap="sm">
                {onUploadClick && (
                  <Button
                    leftSection={<IconUpload size={16} />}
                    variant="light"
                    onClick={onUploadClick}
                  >
                    Upload
                  </Button>
                )}
              </Group>
              <Group gap="sm">
                {selectedImage && !selectedImage.isPrimary && (
                  <Tooltip label="Set as primary image">
                    <Button
                      leftSection={<IconStar size={16} />}
                      variant="light"
                      color="yellow"
                      onClick={handleSetPrimary}
                      loading={isSettingPrimary}
                    >
                      Set Primary
                    </Button>
                  </Tooltip>
                )}
                {selectedImage && (
                  <Tooltip label="Delete this image">
                    <Button
                      leftSection={<IconTrash size={16} />}
                      variant="light"
                      color="red"
                      onClick={handleDelete}
                      loading={isDeleting}
                    >
                      Delete
                    </Button>
                  </Tooltip>
                )}
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}
