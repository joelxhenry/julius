import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { imageCache } from '../utils/imageCache';

export interface InventoryImage {
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
}

export interface InventoryImageWithData extends InventoryImage {
  imageBase64?: string;
  thumbnailBase64?: string;
}

export interface UseInventoryImagesOptions {
  sku: string;
  isVariant?: boolean;
  autoLoad?: boolean;
}

export interface UseInventoryImagesReturn {
  images: InventoryImage[];
  imagesWithData: InventoryImageWithData[];
  primaryThumbnail: string | null;
  isLoading: boolean;
  error: string | null;
  loadImages: () => Promise<void>;
  loadImagesWithData: () => Promise<void>;
  loadPrimaryThumbnail: () => Promise<string | null>;
  uploadImage: (file: File, isPrimary?: boolean) => Promise<InventoryImage | null>;
  deleteImage: (imageId: number) => Promise<boolean>;
  setPrimaryImage: (imageId: number) => Promise<boolean>;
  reorderImages: (imageIds: number[]) => Promise<boolean>;
  invalidateCache: () => void;
}

/**
 * Hook for managing inventory images
 */
export function useInventoryImages({
  sku,
  isVariant = false,
  autoLoad = false,
}: UseInventoryImagesOptions): UseInventoryImagesReturn {
  const [images, setImages] = useState<InventoryImage[]>([]);
  const [imagesWithData, setImagesWithData] = useState<InventoryImageWithData[]>([]);
  const [primaryThumbnail, setPrimaryThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_IMAGES, {
        sku,
        isVariant,
      });

      if (result.success) {
        setImages(result.data || []);
      } else {
        setError(result.error || 'Failed to load images');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, [sku, isVariant]);

  const loadImagesWithData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_IMAGES_WITH_DATA, {
        sku,
        isVariant,
      });

      if (result.success) {
        setImagesWithData(result.data || []);
        setImages(result.data || []);
      } else {
        setError(result.error || 'Failed to load images');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, [sku, isVariant]);

  const loadPrimaryThumbnail = useCallback(async (): Promise<string | null> => {
    // Check cache first
    const cached = imageCache.get(sku, isVariant);
    if (cached) {
      setPrimaryThumbnail(cached);
      return cached;
    }

    try {
      const thumbnail = await imageCache.loadThumbnail(sku, isVariant);
      setPrimaryThumbnail(thumbnail);
      return thumbnail;
    } catch (err) {
      console.error('Failed to load primary thumbnail:', err);
      return null;
    }
  }, [sku, isVariant]);

  const uploadImage = useCallback(
    async (file: File, isPrimary?: boolean): Promise<InventoryImage | null> => {
      try {
        // Read file as base64
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        const result = await window.electron.invoke(IpcChannel.UPLOAD_INVENTORY_IMAGE, {
          sku,
          isVariant,
          fileData: base64,
          fileName: file.name,
          mimeType: file.type,
          isPrimary,
        });

        if (result.success) {
          // Invalidate cache
          imageCache.invalidate(sku, isVariant);
          // Reload images
          await loadImages();
          return result.data;
        } else {
          setError(result.error || 'Failed to upload image');
          return null;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload image');
        return null;
      }
    },
    [sku, isVariant, loadImages]
  );

  const deleteImage = useCallback(
    async (imageId: number): Promise<boolean> => {
      try {
        const result = await window.electron.invoke(IpcChannel.DELETE_INVENTORY_IMAGE, {
          imageId,
        });

        if (result.success) {
          // Invalidate cache (might have deleted primary)
          imageCache.invalidate(sku, isVariant);
          // Reload images
          await loadImages();
          return true;
        } else {
          setError(result.error || 'Failed to delete image');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete image');
        return false;
      }
    },
    [sku, isVariant, loadImages]
  );

  const setPrimaryImageFn = useCallback(
    async (imageId: number): Promise<boolean> => {
      try {
        const result = await window.electron.invoke(IpcChannel.SET_PRIMARY_IMAGE, {
          imageId,
        });

        if (result.success) {
          // Invalidate cache
          imageCache.invalidate(sku, isVariant);
          // Reload images
          await loadImages();
          return true;
        } else {
          setError(result.error || 'Failed to set primary image');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set primary image');
        return false;
      }
    },
    [sku, isVariant, loadImages]
  );

  const reorderImages = useCallback(
    async (imageIds: number[]): Promise<boolean> => {
      try {
        const result = await window.electron.invoke(IpcChannel.REORDER_IMAGES, {
          imageIds,
        });

        if (result.success) {
          // Reload images
          await loadImages();
          return true;
        } else {
          setError(result.error || 'Failed to reorder images');
          return false;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reorder images');
        return false;
      }
    },
    [loadImages]
  );

  const invalidateCache = useCallback(() => {
    imageCache.invalidate(sku, isVariant);
  }, [sku, isVariant]);

  // Auto-load if enabled
  useEffect(() => {
    if (autoLoad && sku) {
      loadImages();
    }
  }, [autoLoad, sku, loadImages]);

  return {
    images,
    imagesWithData,
    primaryThumbnail,
    isLoading,
    error,
    loadImages,
    loadImagesWithData,
    loadPrimaryThumbnail,
    uploadImage,
    deleteImage,
    setPrimaryImage: setPrimaryImageFn,
    reorderImages,
    invalidateCache,
  };
}

/**
 * Hook for preloading thumbnails for a list of items (used in tables)
 */
export function usePreloadThumbnails() {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const preload = useCallback(
    async (items: Array<{ sku: string; isVariant: boolean }>) => {
      if (items.length === 0) return;

      setIsLoading(true);
      try {
        const result = await imageCache.preloadThumbnails(items);
        setThumbnails(result);
      } catch (err) {
        console.error('Failed to preload thumbnails:', err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getThumbnail = useCallback(
    (sku: string, isVariant: boolean): string | null => {
      const key = `${isVariant ? 'variant' : 'inventory'}:${sku}`;
      return thumbnails.get(key) || null;
    },
    [thumbnails]
  );

  return {
    thumbnails,
    isLoading,
    preload,
    getThumbnail,
  };
}
