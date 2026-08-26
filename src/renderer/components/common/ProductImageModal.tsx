import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Stack,
  Group,
  Image,
  Text,
  Button,
  Skeleton,
  Box,
  Center,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE, FileWithPath } from '@mantine/dropzone';
import {
  IconPhoto,
  IconUpload,
  IconTrash,
  IconReplace,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { imageCache } from '../../utils/imageCache';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface InventoryImage {
  id: number;
  sku: string;
  isVariant: boolean;
  fileName: string;
  fileSize: number | null;
  isPrimary: boolean;
  imageBase64?: string;
}

interface ProductImageModalProps {
  opened: boolean;
  onClose: () => void;
  sku: string;
  isVariant?: boolean;
  title?: string;
  onImagesChange?: () => void;
}

/**
 * Manages the single image for a product/variant. Shows the current image (if
 * any) and lets the user upload one or replace/remove the existing one.
 */
export function ProductImageModal({
  opened,
  onClose,
  sku,
  isVariant = false,
  title,
  onImagesChange,
}: ProductImageModalProps) {
  const [image, setImage] = useState<InventoryImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadImage = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_IMAGES_WITH_DATA, {
        sku,
        isVariant,
      });
      if (result.success && result.data) {
        // The system keeps a single image per SKU, but legacy items may still
        // have several — prefer the primary, falling back to the first.
        const images = result.data as InventoryImage[];
        setImage(images.find((img) => img.isPrimary) ?? images[0] ?? null);
      } else {
        setImage(null);
      }
    } catch (error) {
      console.error('Failed to load image:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load image',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [sku, isVariant]);

  useEffect(() => {
    if (opened) {
      loadImage();
    }
  }, [opened, sku, isVariant, loadImage]);

  const handleUpload = useCallback(
    async (files: FileWithPath[]) => {
      const file = files[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const result = await window.electron.invoke(IpcChannel.UPLOAD_INVENTORY_IMAGE, {
          sku,
          isVariant,
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
          isPrimary: true,
        });

        if (result.success) {
          imageCache.invalidate(sku, isVariant);
          await loadImage();
          onImagesChange?.();
          notifications.show({
            title: 'Image Saved',
            message: 'The product image has been updated',
            color: 'green',
          });
        } else {
          notifications.show({
            title: 'Error',
            message: result.error || 'Failed to upload image',
            color: 'red',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to upload image',
          color: 'red',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [sku, isVariant, loadImage, onImagesChange]
  );

  const handleDelete = useCallback(async () => {
    if (!image) return;

    setIsDeleting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.DELETE_INVENTORY_IMAGE, {
        imageId: image.id,
      });

      if (result.success) {
        imageCache.invalidate(sku, isVariant);
        await loadImage();
        onImagesChange?.();
        notifications.show({
          title: 'Image Removed',
          message: 'The product image has been removed',
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to remove image',
          color: 'red',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to remove image',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [image, sku, isVariant, loadImage, onImagesChange]);

  const busy = isUploading || isDeleting;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPhoto size={20} />
          <Text fw={600}>{title || `Image: ${sku}`}</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {isLoading ? (
          <Skeleton height={360} />
        ) : (
          <>
            {image?.imageBase64 && (
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--mantine-color-gray-1)',
                  borderRadius: 'var(--mantine-radius-md)',
                  padding: 16,
                }}
              >
                <Image
                  src={image.imageBase64}
                  alt={image.fileName}
                  fit="contain"
                  mah={360}
                />
              </Box>
            )}

            {/* Dropzone for upload / replace */}
            <Dropzone
              onDrop={handleUpload}
              onReject={(rejections) => {
                rejections.forEach((rejection) => {
                  notifications.show({
                    title: 'File Rejected',
                    message: `${rejection.file.name}: ${rejection.errors[0]?.message || 'Invalid file'}`,
                    color: 'red',
                  });
                });
              }}
              maxSize={MAX_FILE_SIZE}
              maxFiles={1}
              accept={IMAGE_MIME_TYPE}
              loading={isUploading}
              disabled={busy}
            >
              <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload size={48} color="var(--mantine-color-blue-6)" stroke={1.5} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={48} color="var(--mantine-color-red-6)" stroke={1.5} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  {image ? (
                    <IconReplace size={48} color="var(--mantine-color-dimmed)" stroke={1.5} />
                  ) : (
                    <IconPhoto size={48} color="var(--mantine-color-dimmed)" stroke={1.5} />
                  )}
                </Dropzone.Idle>

                <div>
                  <Text size="lg" inline>
                    {image ? 'Drag an image here to replace' : 'Drag an image here or click to upload'}
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    One image per product, up to 10MB
                  </Text>
                </div>
              </Group>
            </Dropzone>

            {image && (
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  {image.fileName}
                  {image.fileSize && <> ({(image.fileSize / 1024).toFixed(1)} KB)</>}
                </Text>
                <Button
                  leftSection={<IconTrash size={16} />}
                  variant="light"
                  color="red"
                  onClick={handleDelete}
                  loading={isDeleting}
                  disabled={isUploading}
                >
                  Remove
                </Button>
              </Group>
            )}

            {!image && !isLoading && (
              <Center>
                <Text size="sm" c="dimmed">
                  No image for this item yet
                </Text>
              </Center>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
}
